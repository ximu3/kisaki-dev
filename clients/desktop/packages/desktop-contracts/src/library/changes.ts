/** @fileoverview Defines complete-operation library facts and independently coalescible read invalidation areas. */

import type {
  EntryRef,
  ExternalIdentity,
  PartRef,
  PartType,
  WorkRef,
  PartWorkType,
  WorkType,
} from './catalog'
import type {
  WorkCharacterBinding,
  PersonWorkBinding,
  OrganizationWorkBinding,
  StoredWorkRelationBinding,
} from './relations'
import type { NonEmptyArray } from '../operations'
import * as v from 'valibot'
import { entryRefSchema, identitiesSchema, partRefSchema, workRefSchema } from './catalog'
import { nonemptyText, text, id, unique, parseRecord, parseValue, timestamp } from '../validation'
import { partWorkType } from './parts'
import { DesktopError } from '../errors'
import {
  parseWorkCharacterBinding,
  parsePersonWorkBinding,
  parseOrganizationWorkBinding,
  parseStoredWorkRelationBinding,
} from './relations'

/** Minimal deleted/merged identity explanation; no body, image bytes, personal record or relationship graph is included. */
export interface EntryIdentitySnapshot {
  readonly ref: EntryRef
  readonly name: string
  readonly externalIdentities: readonly ExternalIdentity[]
}

export interface PartIdentitySnapshot {
  readonly ref: PartRef
  readonly name: string | null
  readonly externalIdentities: readonly ExternalIdentity[]
}

export type RelationIdentitySnapshot =
  | ({ readonly type: 'workCharacter'; readonly id: string } & WorkCharacterBinding)
  | ({ readonly type: 'personWork'; readonly id: string } & PersonWorkBinding)
  | ({ readonly type: 'organizationWork'; readonly id: string } & OrganizationWorkBinding)
  | {
      readonly type: 'workRelation'
      readonly id: string
      readonly binding: StoredWorkRelationBinding
    }

type PartChangeContext = {
  [K in PartType]: { readonly part: PartRef<K>; readonly work: WorkRef<PartWorkType<K>> }
}[PartType]

type AnnotationChangeContext = {
  [K in WorkType]: { readonly annotationId: string; readonly work: WorkRef<K> } & (K extends 'game'
    ? object
    : { readonly fileId: string | null })
}[WorkType]

/** Only actual changed identities are included; a file merge retains both the removed and surviving identity. */
export type HoldingsChangeContext = {
  [K in WorkType]: {
    readonly work: WorkRef<K>
    readonly directoryIds?: readonly string[]
  } & (K extends 'game'
    ? { readonly launchConfigIds?: readonly string[]; readonly backupIds?: readonly string[] }
    : {
        readonly fileIds?: readonly string[]
        readonly fileMerged?: { readonly sourceFileId: string; readonly targetFileId: string }
      })
}[WorkType]

export type LibraryChange =
  | {
      readonly type: 'entryCreated' | 'entryUpdated' | 'evaluationChanged'
      readonly entry: EntryRef
    }
  | { readonly type: 'entryDeleted'; readonly snapshot: EntryIdentitySnapshot }
  | {
      readonly type: 'entriesMerged'
      readonly sources: NonEmptyArray<EntryIdentitySnapshot>
      readonly target: EntryRef
    }
  | { readonly type: 'workRecordChanged'; readonly work: WorkRef }
  | ({
      readonly type: 'partCreated' | 'partUpdated' | 'partDeleted' | 'partRecordChanged'
    } & PartChangeContext)
  | {
      readonly type: 'partMoved'
      readonly part: PartRef
      readonly fromWork: WorkRef
      readonly toWork: WorkRef
    }
  | {
      readonly type: 'partKindChanged'
      readonly fromPart: PartRef<'animeEpisode' | 'animeExtra'>
      readonly toPart: PartRef<'animeEpisode' | 'animeExtra'>
      readonly work: WorkRef<'anime'>
    }
  | {
      readonly type: 'partMerged'
      readonly source: PartIdentitySnapshot
      readonly target: PartRef
      readonly work: WorkRef
    }
  | {
      readonly type: 'relationCreated' | 'relationUpdated' | 'relationDeleted'
      readonly relation: RelationIdentitySnapshot
    }
  | { readonly type: 'collectionCreated' | 'collectionUpdated'; readonly collectionId: string }
  | { readonly type: 'collectionDeleted'; readonly collectionId: string; readonly name: string }
  | {
      readonly type: 'collectionsMerged'
      readonly sourceIds: NonEmptyArray<string>
      readonly targetId: string
    }
  | {
      readonly type: 'collectionMembersChanged'
      readonly collectionId: string
      readonly entries: readonly EntryRef[]
    }
  | { readonly type: 'tagCreated' | 'tagUpdated'; readonly tagId: string }
  | { readonly type: 'tagDeleted'; readonly tagId: string; readonly name: string }
  | {
      readonly type: 'tagsMerged'
      readonly sourceIds: NonEmptyArray<string>
      readonly targetId: string
    }
  | {
      readonly type: 'entryTagsChanged'
      readonly entry: EntryRef
      readonly tagIds: readonly string[]
    }
  | {
      readonly type: 'noteCreated' | 'noteUpdated' | 'noteDeleted'
      readonly noteId: string
      readonly entries: readonly EntryRef[]
    }
  | ({
      readonly type: 'annotationCreated' | 'annotationUpdated' | 'annotationDeleted'
    } & AnnotationChangeContext)
  | {
      readonly type: 'activityCreated' | 'activityUpdated' | 'activityDeleted'
      readonly activityId: string
      readonly work: WorkRef
    }
  | ({ readonly type: 'holdingsChanged' } & HoldingsChangeContext)
  | { readonly type: 'showcaseChanged'; readonly sectionIds: readonly string[] }

/** One successful complete operation emits its own fact boundary; no-change success emits nothing. */
export interface LibraryChanged {
  /** UTC milliseconds since the Unix epoch. */
  readonly committedAt: number
  readonly changes: NonEmptyArray<LibraryChange>
}

export const libraryInvalidationAreas = Object.freeze([
  'entries',
  'parts',
  'relations',
  'collections',
  'tags',
  'notes',
  'annotations',
  'activities',
  'holdings',
  'showcase',
] as const)

export type LibraryInvalidationArea = (typeof libraryInvalidationAreas)[number]

/** Areas may coalesce across operations; they never carry write commands, query snapshots or replacement drafts. */
export interface LibraryInvalidation {
  readonly areas: NonEmptyArray<LibraryInvalidationArea>
}

const entrySnapshot = v.strictObject({
  ref: entryRefSchema,
  name: nonemptyText,
  externalIdentities: identitiesSchema,
})

const partSnapshot = v.strictObject({
  ref: partRefSchema,
  name: v.nullable(text),
  externalIdentities: identitiesSchema,
})

const ids = v.pipe(
  v.array(id),
  v.check((values) => unique(values, (value) => value)),
)

const nonemptyIds = v.pipe(
  v.tupleWithRest([id], id),
  v.check((values) => unique(values, (value) => value)),
)

const entries = v.pipe(
  v.array(entryRefSchema),
  v.check((values) => unique(values, (value) => value.id)),
)

function assertPartWork(part: PartRef, work: WorkRef): void {
  const type = partWorkType(part.type)
  if (work.type !== type) {
    throw new DesktopError('InvalidInput', 'Part fact has the wrong work type')
  }
}

/** A relation fact keeps its real endpoints and role, without exposing arbitrary related objects. */
export function parseRelationIdentitySnapshot(input: unknown): RelationIdentitySnapshot {
  const { type: typeInput, id: identityInput, ...originalBody } = parseRecord(input)
  const type = parseValue(
    v.picklist(['workCharacter', 'personWork', 'organizationWork', 'workRelation']),
    typeInput,
  )
  const identity = parseValue(id, identityInput)
  if (type === 'workCharacter') {
    return { type, id: identity, ...parseWorkCharacterBinding(originalBody) }
  }
  if (type === 'personWork') {
    return { type, id: identity, ...parsePersonWorkBinding(originalBody) }
  }
  if (type === 'organizationWork') {
    return { type, id: identity, ...parseOrganizationWorkBinding(originalBody) }
  }

  return {
    type,
    id: identity,
    ...parseValue(
      v.strictObject({ binding: v.pipe(v.unknown(), v.transform(parseStoredWorkRelationBinding)) }),
      originalBody,
    ),
  }
}

/** Validate actual-operation payloads, including media applicability and preserved kind-change/merge identities. */
export function parseLibraryChange(input: unknown): LibraryChange {
  const value = parseValue(
    v.variant('type', [
      v.strictObject({
        type: v.picklist(['entryCreated', 'entryUpdated', 'evaluationChanged']),
        entry: entryRefSchema,
      }),
      v.strictObject({ type: v.literal('entryDeleted'), snapshot: entrySnapshot }),
      v.strictObject({
        type: v.literal('entriesMerged'),
        sources: v.pipe(
          v.tupleWithRest([entrySnapshot], entrySnapshot),
          v.check((values) => unique(values, (value) => value.ref.id)),
        ),
        target: entryRefSchema,
      }),
      v.strictObject({ type: v.literal('workRecordChanged'), work: workRefSchema }),
      v.strictObject({
        type: v.picklist(['partCreated', 'partUpdated', 'partDeleted', 'partRecordChanged']),
        part: partRefSchema,
        work: workRefSchema,
      }),
      v.strictObject({
        type: v.literal('partMoved'),
        part: partRefSchema,
        fromWork: workRefSchema,
        toWork: workRefSchema,
      }),
      v.strictObject({
        type: v.literal('partKindChanged'),
        fromPart: partRefSchema,
        toPart: partRefSchema,
        work: workRefSchema,
      }),
      v.strictObject({
        type: v.literal('partMerged'),
        source: partSnapshot,
        target: partRefSchema,
        work: workRefSchema,
      }),
      v.strictObject({
        type: v.picklist(['relationCreated', 'relationUpdated', 'relationDeleted']),
        relation: v.pipe(v.unknown(), v.transform(parseRelationIdentitySnapshot)),
      }),
      v.strictObject({
        type: v.picklist(['collectionCreated', 'collectionUpdated']),
        collectionId: id,
      }),
      v.strictObject({
        type: v.literal('collectionDeleted'),
        collectionId: id,
        name: nonemptyText,
      }),
      v.strictObject({
        type: v.literal('collectionsMerged'),
        sourceIds: nonemptyIds,
        targetId: id,
      }),
      v.strictObject({ type: v.literal('collectionMembersChanged'), collectionId: id, entries }),
      v.strictObject({ type: v.picklist(['tagCreated', 'tagUpdated']), tagId: id }),
      v.strictObject({ type: v.literal('tagDeleted'), tagId: id, name: nonemptyText }),
      v.strictObject({ type: v.literal('tagsMerged'), sourceIds: nonemptyIds, targetId: id }),
      v.strictObject({ type: v.literal('entryTagsChanged'), entry: entryRefSchema, tagIds: ids }),
      v.strictObject({
        type: v.picklist(['noteCreated', 'noteUpdated', 'noteDeleted']),
        noteId: id,
        entries,
      }),
      v.strictObject({
        type: v.picklist(['annotationCreated', 'annotationUpdated', 'annotationDeleted']),
        annotationId: id,
        work: workRefSchema,
        fileId: v.exactOptional(v.nullable(id)),
      }),
      v.strictObject({
        type: v.picklist(['activityCreated', 'activityUpdated', 'activityDeleted']),
        activityId: id,
        work: workRefSchema,
      }),
      v.strictObject({
        type: v.literal('holdingsChanged'),
        work: workRefSchema,
        directoryIds: v.exactOptional(ids),
        fileIds: v.exactOptional(ids),
        launchConfigIds: v.exactOptional(ids),
        backupIds: v.exactOptional(ids),
        fileMerged: v.exactOptional(v.strictObject({ sourceFileId: id, targetFileId: id })),
      }),
      v.strictObject({ type: v.literal('showcaseChanged'), sectionIds: ids }),
    ]),
    input,
    'Invalid library change',
  )
  if (
    value.type === 'entriesMerged' &&
    value.sources.some(
      (source) => source.ref.id === value.target.id || source.ref.type !== value.target.type,
    )
  ) {
    throw new DesktopError('InvalidInput', 'Merged entry identities must be distinct and same-kind')
  }

  if (value.type === 'collectionsMerged' || value.type === 'tagsMerged') {
    if (value.sourceIds.includes(value.targetId)) {
      throw new DesktopError('InvalidInput', 'A merge survivor cannot also be removed')
    }
  }

  if ('part' in value && 'work' in value) {
    assertPartWork(value.part, value.work)
  }

  if (value.type === 'partMoved') {
    assertPartWork(value.part, value.fromWork)
    assertPartWork(value.part, value.toWork)
    if (value.fromWork.id === value.toWork.id) {
      throw new DesktopError('InvalidInput', 'A part move must change its owner')
    }
  }

  if (value.type === 'partKindChanged') {
    assertPartWork(value.fromPart, value.work)
    assertPartWork(value.toPart, value.work)
    if (
      value.work.type !== 'anime' ||
      value.fromPart.type === value.toPart.type ||
      value.fromPart.id !== value.toPart.id
    ) {
      throw new DesktopError(
        'InvalidInput',
        'Part kind correction must preserve one anime content identity',
      )
    }
  }

  if (value.type === 'partMerged') {
    assertPartWork(value.source.ref, value.work)
    assertPartWork(value.target, value.work)
    if (value.source.ref.type !== value.target.type || value.source.ref.id === value.target.id) {
      throw new DesktopError('InvalidInput', 'Part merge requires distinct same-kind identities')
    }
  }

  if ('annotationId' in value && (value.work.type === 'game') === Object.hasOwn(value, 'fileId')) {
    throw new DesktopError('InvalidInput', 'Annotation change has inapplicable file context')
  }

  if (value.type === 'holdingsChanged') {
    if (
      (value.work.type === 'game' &&
        (value.fileIds !== undefined || value.fileMerged !== undefined)) ||
      (value.work.type !== 'game' &&
        (value.launchConfigIds !== undefined || value.backupIds !== undefined)) ||
      (value.fileMerged && value.fileMerged.sourceFileId === value.fileMerged.targetFileId)
    ) {
      throw new DesktopError('InvalidInput', 'Holdings change has inapplicable target identities')
    }
  }

  return value as LibraryChange
}

/** Require a real changed fact boundary. Delivery failures cannot alter already committed business data. */
export function parseLibraryChanged(input: unknown): LibraryChanged {
  const change = v.pipe(v.unknown(), v.transform(parseLibraryChange))
  return parseValue(
    v.strictObject({ committedAt: timestamp, changes: v.tupleWithRest([change], change) }),
    input,
    'Invalid library change event',
  )
}

/** Validate a nonempty set of affected read areas, without interpreting it as a business fact or query result. */
export function parseLibraryInvalidation(input: unknown): LibraryInvalidation {
  const area = v.picklist(libraryInvalidationAreas)
  return parseValue(
    v.strictObject({
      areas: v.pipe(
        v.tupleWithRest([area], area),
        v.check((values) => unique(values, (value) => value)),
      ),
    }),
    input,
    'Invalid library read invalidation',
  )
}
