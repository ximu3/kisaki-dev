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

/**
 * Minimal identity and naming context retained for a deleted or merged entry.
 *
 * The snapshot excludes body content, image bytes, personal records and relationship graphs.
 */
export interface EntryIdentitySnapshot {
  readonly ref: EntryRef
  readonly name: string
  readonly externalIdentities: readonly ExternalIdentity[]
}

/** Minimal identity, name and external identities retained for a merged part. */
export interface PartIdentitySnapshot {
  readonly ref: PartRef
  readonly name: string | null
  readonly externalIdentities: readonly ExternalIdentity[]
}

/** A saved relation identity with its exact typed endpoints and binding. */
export type RelationIdentitySnapshot =
  | ({ readonly type: 'workCharacter'; readonly id: string } & WorkCharacterBinding)
  | ({ readonly type: 'personWork'; readonly id: string } & PersonWorkBinding)
  | ({ readonly type: 'organizationWork'; readonly id: string } & OrganizationWorkBinding)
  | {
      readonly type: 'workRelation'
      readonly id: string
      readonly binding: StoredWorkRelationBinding
    }

/** A changed part paired with the owning work kind allowed for that part. */
type PartChangeContext = {
  [K in PartType]: { readonly part: PartRef<K>; readonly work: WorkRef<PartWorkType<K>> }
}[PartType]

/** A changed annotation and its work, with file context for file-based media. */
type AnnotationChangeContext = {
  [K in WorkType]: { readonly annotationId: string; readonly work: WorkRef<K> } & (K extends 'game'
    ? object
    : { readonly fileId: string | null })
}[WorkType]

/**
 * Actual changed holdings identities within one work.
 *
 * File merges retain both the removed and surviving identities.
 */
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

/** One typed saved-fact change within a completed library operation. */
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

/**
 * The nonempty facts committed by one successful complete library operation.
 *
 * Success without changes emits no event. Delivery failure cannot alter committed data.
 */
export interface LibraryChanged {
  /** UTC milliseconds since the Unix epoch. */
  readonly committedAt: number
  readonly changes: NonEmptyArray<LibraryChange>
}

/** Library capability areas whose saved projections can be invalidated by committed changes. */
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

/** A library read area whose snapshot may need refreshing. */
export type LibraryInvalidationArea = (typeof libraryInvalidationAreas)[number]

/**
 * Read areas invalidated by library changes.
 *
 * Areas may coalesce across operations; this value carries no write command, query snapshot or
 * editing draft.
 */
export interface LibraryInvalidation {
  readonly areas: NonEmptyArray<LibraryInvalidationArea>
}

/** Entry identity, saved name and external coordinates retained with a change fact. */
const entrySnapshot = v.strictObject({
  ref: entryRefSchema,
  name: nonemptyText,
  externalIdentities: identitiesSchema,
})

/** Part identity, optional saved name and external coordinates retained with a change fact. */
const partSnapshot = v.strictObject({
  ref: partRefSchema,
  name: v.nullable(text),
  externalIdentities: identitiesSchema,
})

/** Distinct local identities in a committed change payload, allowing an empty set. */
const ids = v.pipe(
  v.array(id),
  v.check((values) => unique(values, (value) => value)),
)

/** Nonempty distinct local identities for change facts that require affected objects. */
const nonemptyIds = v.pipe(
  v.tupleWithRest([id], id),
  v.check((values) => unique(values, (value) => value)),
)

/** Distinct typed entry references retained in library change notifications. */
const entries = v.pipe(
  v.array(entryRefSchema),
  v.check((values) => unique(values, (value) => value.id)),
)

/** Checks that a part fact uses the work kind allowed by its part type. */
function assertPartWork(part: PartRef, work: WorkRef): void {
  const type = partWorkType(part.type)
  if (work.type !== type) {
    throw new DesktopError('InvalidInput', 'Part fact has the wrong work type')
  }
}

/** Parses a relation's identity and exact typed endpoints or stored binding. */
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

/**
 * Parses a typed change fact and checks media applicability, ownership kinds and merge identities.
 */
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

/** Parses a commit timestamp and nonempty set of complete-operation library facts. */
export function parseLibraryChanged(input: unknown): LibraryChanged {
  const change = v.pipe(v.unknown(), v.transform(parseLibraryChange))
  return parseValue(
    v.strictObject({ committedAt: timestamp, changes: v.tupleWithRest([change], change) }),
    input,
    'Invalid library change event',
  )
}

/** Parses a nonempty, distinct set of affected read areas. */
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
