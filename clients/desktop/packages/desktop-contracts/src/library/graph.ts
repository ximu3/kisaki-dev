/** @fileoverview Defines atomic library graph intent and validates temporary addresses before any persistent work. */

import * as v from 'valibot'
import { invalidInput } from '../errors'
import { absolutePathSchema } from '../paths'
import { preparedAttachmentSchema, type PreparedAttachment } from '../resources'
import { objectSchema, plainRecordSchema } from '../schema'
import {
  exactPartialEntries,
  hasUniqueKeys,
  nonemptyStringSchema,
  parseContract,
} from '../validation'
import {
  entryMetadataFields,
  initialEntries,
  workInitialEntries,
  parseEntryUpdate,
  type EntryCreateInput,
  type EntryTag,
  type EntryUpdate,
} from './catalog'
import { parseDirectoryDiscoveryDefinition, type DirectoryCreate } from './holdings'
import {
  entryRefSchema,
  partRefSchema,
  entryTypes,
  workTypes,
  type EntryRef,
  type EntryType,
  type PartRef,
  type PartType,
  type WorkType,
} from './identity'
import { parseGameLaunchConfigFields, type GameLaunchConfigFields } from './launch-configs'
import { parseTagCreate, parseTagUpdate, type TagCreate, type TagUpdate } from './organizers'
import {
  partMetadataFields,
  parsePartUpdate,
  type PartCreateFields,
  type PartUpdate,
  type PartWorkType,
} from './parts'
import {
  characterRoles,
  organizationRoles,
  personRoles,
  workRelationTypes,
  workCharacterBindingSchema,
  personWorkBindingSchema,
  organizationWorkBindingSchema,
  workRelationBindingSchema,
  parseRelationUpdate,
  normalizeWorkRelation,
  isPersonRoleAllowed,
  isOrganizationRoleAllowed,
  isWorkRelationAllowed,
  type CharacterRole,
  type OrganizationRole,
  type PersonRole,
  type RelationKind,
  type RelationSnapshot,
  type RelationUpdate,
  type WorkRelationType,
} from './relations'

/** A request-local key is resolved only within the corresponding create collection. */
export type GraphEntryRef<Type extends EntryType = EntryType> =
  EntryRef<Type> | { readonly key: string }
export type GraphPartRef<Type extends PartType = PartType> =
  PartRef<Type> | { readonly key: string }
export type GraphTagRef = { readonly id: string } | { readonly key: string }
export type GraphEntryCreate = {
  [Type in EntryType]: Omit<EntryCreateInput<Type>, 'tags'> & {
    readonly key: string
    readonly tags?: readonly {
      readonly tagId: GraphTagRef
      readonly note?: string | null
      readonly isSpoiler?: boolean
    }[]
  }
}[EntryType]
export type GraphPartCreate = {
  [Type in PartType]: {
    readonly key: string
    readonly type: Type
    readonly work: GraphEntryRef<PartWorkType<Type>>
    readonly data: PartCreateFields<Type>
    readonly completed?: boolean
  }
}[PartType]
export type GraphTagCreate = Omit<TagCreate, 'prepared'> & { readonly key: string }
export interface GraphRelationBindings {
  readonly workCharacters: {
    readonly work: GraphEntryRef<WorkType>
    readonly character: GraphEntryRef<'character'>
    readonly role: CharacterRole | null
  }
  readonly personWorks: {
    readonly work: GraphEntryRef<WorkType>
    readonly person: GraphEntryRef<'person'>
    readonly character: GraphEntryRef<'character'> | null
    readonly role: PersonRole
  }
  readonly organizationWorks: {
    readonly work: GraphEntryRef<WorkType>
    readonly organization: GraphEntryRef<'organization'>
    readonly role: OrganizationRole
  }
  readonly workRelations: {
    readonly from: GraphEntryRef<WorkType>
    readonly to: GraphEntryRef<WorkType>
    readonly type: WorkRelationType
  }
}
export type GraphRelationAdd<Type extends RelationKind> = GraphRelationBindings[Type] & {
  readonly note?: string | null
} & (Type extends 'workRelations' ? object : { readonly isSpoiler?: boolean })
export interface GraphRelationChanges<Type extends RelationKind> {
  readonly add?: readonly GraphRelationAdd<Type>[]
  readonly update?: readonly ({ readonly id: string } & RelationUpdate<Type>)[]
  readonly remove?: readonly string[]
  /** Only complete snapshots of this request's explicitly removed facts may appear here. */
  readonly expected?: readonly RelationSnapshot<Type>[]
}
export interface GraphEntryTag {
  readonly tagId: GraphTagRef
  readonly note: string | null
  readonly isSpoiler: boolean
}
export type GraphEntryTagChange =
  | { readonly type: 'replace'; readonly items: readonly GraphEntryTag[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly GraphEntryTag[]
      readonly remove?: readonly GraphTagRef[]
    }
export interface GraphVolumeChapter {
  readonly chapter: GraphPartRef<'comicChapter'>
  readonly numberLabel: string | null
}
export interface VolumeChapter {
  readonly chapter: PartRef<'comicChapter'>
  readonly numberLabel: string | null
}
export type GraphVolumeChapterChange =
  | { readonly type: 'replace'; readonly items: readonly GraphVolumeChapter[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly GraphVolumeChapter[]
      readonly remove?: readonly GraphPartRef<'comicChapter'>[]
    }
export interface GraphRelations {
  readonly workCharacters?: GraphRelationChanges<'workCharacters'>
  readonly personWorks?: GraphRelationChanges<'personWorks'>
  readonly organizationWorks?: GraphRelationChanges<'organizationWorks'>
  readonly workRelations?: GraphRelationChanges<'workRelations'>
  readonly entryTags?: readonly {
    readonly entry: GraphEntryRef
    readonly change: GraphEntryTagChange
    readonly expected?: readonly EntryTag[]
  }[]
  readonly volumeChapters?: readonly {
    readonly volume: GraphPartRef<'comicVolume'>
    readonly change: GraphVolumeChapterChange
    readonly expected?: readonly VolumeChapter[]
  }[]
}
export interface GraphFileCreate {
  readonly path: string
  readonly parts?: readonly GraphPartRef[]
  readonly isPreferred?: boolean
  readonly note?: string | null
}
export interface GraphLocalContent {
  readonly game?: readonly {
    readonly work: GraphEntryRef<'game'>
    readonly directories?: readonly DirectoryCreate<'game'>[]
    readonly launchConfigs?: readonly GameLaunchConfigFields[]
  }[]
  readonly anime?: readonly {
    readonly work: GraphEntryRef<'anime'>
    readonly directories?: readonly DirectoryCreate<'anime'>[]
    readonly files?: readonly GraphFileCreate[]
  }[]
  readonly comic?: readonly {
    readonly work: GraphEntryRef<'comic'>
    readonly directories?: readonly DirectoryCreate<'comic'>[]
    readonly files?: readonly GraphFileCreate[]
  }[]
  readonly novel?: readonly {
    readonly work: GraphEntryRef<'novel'>
    readonly directories?: readonly DirectoryCreate<'novel'>[]
    readonly files?: readonly GraphFileCreate[]
  }[]
}
/** One graph commits atomically. Prepared resources without a final business reference are not adopted. */
export interface LibraryWriteGraph {
  readonly entries?: {
    readonly create?: readonly GraphEntryCreate[]
    readonly update?: readonly EntryUpdate[]
  }
  readonly parts?: {
    readonly create?: readonly GraphPartCreate[]
    readonly update?: readonly PartUpdate[]
  }
  readonly tags?: {
    readonly create?: readonly GraphTagCreate[]
    readonly update?: readonly ({ readonly id: string } & TagUpdate)[]
  }
  readonly relations?: GraphRelations
  readonly localContent?: GraphLocalContent
  readonly prepared?: readonly PreparedAttachment[]
}
/** Maps contain only this request's actual creations; an empty graph returns empty maps and changed false. */
export interface LibraryWriteResult {
  readonly entries: Readonly<Record<string, EntryRef>>
  readonly parts: Readonly<Record<string, PartRef>>
  readonly tags: Readonly<Record<string, string>>
  readonly changed: boolean
}

const keyRef = objectSchema({ key: nonemptyStringSchema })
function entryRef<Type extends EntryType>(
  types: readonly Type[],
): v.GenericSchema<unknown, GraphEntryRef<Type>> {
  return v.union([keyRef, objectSchema({ type: v.picklist(types), id: nonemptyStringSchema })])
}
function partRef<Type extends PartType>(
  types: readonly Type[],
): v.GenericSchema<unknown, GraphPartRef<Type>> {
  return v.union([keyRef, objectSchema({ type: v.picklist(types), id: nonemptyStringSchema })])
}
const graphTagRef = v.union([keyRef, objectSchema({ id: nonemptyStringSchema })])
const graphEntryRef = entryRef(entryTypes)
const graphWorkRef = entryRef(workTypes)
const graphCharacterRef = entryRef(['character'])
const graphPartRef = v.union([keyRef, partRefSchema])
const graphTags = v.exactOptional(
  v.pipe(
    v.array(
      objectSchema({
        tagId: graphTagRef,
        note: v.exactOptional(v.nullable(v.string())),
        isSpoiler: v.exactOptional(v.boolean()),
      }),
    ),
    v.check((values) => hasUniqueKeys(values, (item) => referenceKey(item.tagId))),
    v.readonly(),
  ),
)
function entryCreateSchema<
  Type extends EntryType,
  Fields extends v.ObjectEntries,
  WorkFields extends v.ObjectEntries,
>(type: Type, fields: Fields, work: WorkFields) {
  return objectSchema({
    type: v.literal(type),
    ...exactPartialEntries(fields),
    name: nonemptyStringSchema,
    ...initialEntries,
    ...work,
    key: nonemptyStringSchema,
    tags: graphTags,
  })
}
const graphEntryCreate: v.GenericSchema<unknown, GraphEntryCreate> = v.union([
  entryCreateSchema('game', entryMetadataFields.game, workInitialEntries),
  entryCreateSchema('anime', entryMetadataFields.anime, workInitialEntries),
  entryCreateSchema('comic', entryMetadataFields.comic, workInitialEntries),
  entryCreateSchema('novel', entryMetadataFields.novel, workInitialEntries),
  entryCreateSchema('character', entryMetadataFields.character, {}),
  entryCreateSchema('person', entryMetadataFields.person, {}),
  entryCreateSchema('organization', entryMetadataFields.organization, {}),
])
function partCreateSchema<
  Type extends PartType,
  Work extends WorkType,
  Fields extends v.ObjectEntries,
>(type: Type, work: Work, fields: Fields) {
  return objectSchema({
    key: nonemptyStringSchema,
    type: v.literal(type),
    work: entryRef([work]),
    data: objectSchema(exactPartialEntries(fields)),
    completed: v.exactOptional(v.boolean()),
  })
}
const graphPartCreate: v.GenericSchema<unknown, GraphPartCreate> = v.union([
  partCreateSchema('animeEpisode', 'anime', partMetadataFields.animeEpisode),
  partCreateSchema('animeExtra', 'anime', partMetadataFields.animeExtra),
  partCreateSchema('comicVolume', 'comic', partMetadataFields.comicVolume),
  partCreateSchema('comicChapter', 'comic', partMetadataFields.comicChapter),
  partCreateSchema('novelVolume', 'novel', partMetadataFields.novelVolume),
])
const graphTagCreate = v.pipe(
  plainRecordSchema,
  v.transform((input): GraphTagCreate => {
    const { key, ...fields } = input
    const value = parseContract(nonemptyStringSchema, key, 'graph creation key')
    const parsed = parseTagCreate(fields)
    if (parsed.prepared !== undefined) {
      return invalidInput('Graph tag resources belong to the complete graph.')
    }
    return { key: value, ...parsed }
  }),
)

function parseEntryEdit(input: Record<string, unknown>): EntryUpdate {
  const { ref: rawRef, ...fields } = input
  const ref = parseContract(entryRefSchema, rawRef, 'entry update reference')
  switch (ref.type) {
    case 'game':
      return { ref: { type: 'game', id: ref.id }, ...parseEntryUpdate('game', fields) }
    case 'anime':
      return { ref: { type: 'anime', id: ref.id }, ...parseEntryUpdate('anime', fields) }
    case 'comic':
      return { ref: { type: 'comic', id: ref.id }, ...parseEntryUpdate('comic', fields) }
    case 'novel':
      return { ref: { type: 'novel', id: ref.id }, ...parseEntryUpdate('novel', fields) }
    case 'character':
      return { ref: { type: 'character', id: ref.id }, ...parseEntryUpdate('character', fields) }
    case 'person':
      return { ref: { type: 'person', id: ref.id }, ...parseEntryUpdate('person', fields) }
    case 'organization':
      return {
        ref: { type: 'organization', id: ref.id },
        ...parseEntryUpdate('organization', fields),
      }
  }
}
function parsePartEdit(input: Record<string, unknown>): PartUpdate {
  const { ref: rawRef, ...fields } = input
  const ref = parseContract(partRefSchema, rawRef, 'part update reference')
  switch (ref.type) {
    case 'animeEpisode':
      return {
        ref: { type: 'animeEpisode', id: ref.id },
        ...parsePartUpdate('animeEpisode', fields),
      }
    case 'animeExtra':
      return { ref: { type: 'animeExtra', id: ref.id }, ...parsePartUpdate('animeExtra', fields) }
    case 'comicVolume':
      return { ref: { type: 'comicVolume', id: ref.id }, ...parsePartUpdate('comicVolume', fields) }
    case 'comicChapter':
      return {
        ref: { type: 'comicChapter', id: ref.id },
        ...parsePartUpdate('comicChapter', fields),
      }
    case 'novelVolume':
      return { ref: { type: 'novelVolume', id: ref.id }, ...parsePartUpdate('novelVolume', fields) }
  }
}
function identifiedEdit<Value>(parse: (input: unknown) => Value) {
  return v.pipe(
    plainRecordSchema,
    v.transform((input) => {
      const { id, ...fields } = input
      return {
        id: parseContract(nonemptyStringSchema, id, 'graph update identity'),
        ...parse(fields),
      }
    }),
  )
}
const attributes = {
  note: v.exactOptional(v.nullable(v.string())),
  isSpoiler: v.exactOptional(v.boolean()),
}
const workCharacterAdd = objectSchema({
  work: graphWorkRef,
  character: graphCharacterRef,
  role: v.nullable(v.picklist(characterRoles)),
  ...attributes,
})
const personWorkAdd = objectSchema({
  work: graphWorkRef,
  person: entryRef(['person']),
  character: v.nullable(graphCharacterRef),
  role: v.picklist(personRoles),
  ...attributes,
})
const organizationWorkAdd = objectSchema({
  work: graphWorkRef,
  organization: entryRef(['organization']),
  role: v.picklist(organizationRoles),
  ...attributes,
})
const workRelationAdd = objectSchema({
  from: graphWorkRef,
  to: graphWorkRef,
  type: v.picklist(workRelationTypes),
  note: attributes.note,
})
const savedAttributes = {
  id: nonemptyStringSchema,
  note: v.nullable(v.string()),
  isSpoiler: v.boolean(),
}
const relationSnapshotSchemas: {
  [Type in RelationKind]: v.GenericSchema<unknown, RelationSnapshot<Type>>
} = {
  workCharacters: objectSchema({ ...savedAttributes, binding: workCharacterBindingSchema }),
  personWorks: objectSchema({ ...savedAttributes, binding: personWorkBindingSchema }),
  organizationWorks: objectSchema({ ...savedAttributes, binding: organizationWorkBindingSchema }),
  workRelations: objectSchema({
    id: nonemptyStringSchema,
    note: v.nullable(v.string()),
    binding: workRelationBindingSchema,
  }),
}
function relationChanges<Type extends RelationKind>(
  type: Type,
  add: v.GenericSchema<unknown, GraphRelationAdd<Type>>,
) {
  return objectSchema({
    add: optionalArray(add),
    update: optionalArray(identifiedEdit((input) => parseRelationUpdate(type, input))),
    remove: optionalArray(nonemptyStringSchema),
    expected: optionalArray(relationSnapshotSchemas[type]),
  })
}
function optionalArray<Value>(schema: v.GenericSchema<unknown, Value>) {
  return v.exactOptional(v.pipe(v.array(schema), v.readonly()))
}
function membershipChange<Member, Reference>(
  member: v.GenericSchema<unknown, Member>,
  reference: v.GenericSchema<unknown, Reference>,
) {
  return v.union([
    objectSchema({ type: v.literal('replace'), items: v.pipe(v.array(member), v.readonly()) }),
    objectSchema({
      type: v.literal('modify'),
      add: optionalArray(member),
      remove: optionalArray(reference),
    }),
  ])
}
const graphTagMember = objectSchema({
  tagId: graphTagRef,
  note: v.nullable(v.string()),
  isSpoiler: v.boolean(),
})
const volumeChapter = objectSchema({
  chapter: partRef(['comicChapter']),
  numberLabel: v.nullable(nonemptyStringSchema),
})
const relationsSchema: v.GenericSchema<unknown, GraphRelations> = objectSchema({
  workCharacters: v.exactOptional(relationChanges('workCharacters', workCharacterAdd)),
  personWorks: v.exactOptional(relationChanges('personWorks', personWorkAdd)),
  organizationWorks: v.exactOptional(relationChanges('organizationWorks', organizationWorkAdd)),
  workRelations: v.exactOptional(relationChanges('workRelations', workRelationAdd)),
  entryTags: optionalArray(
    objectSchema({
      entry: graphEntryRef,
      change: membershipChange(graphTagMember, graphTagRef),
      expected: optionalArray(
        objectSchema({
          tagId: nonemptyStringSchema,
          note: v.nullable(v.string()),
          isSpoiler: v.boolean(),
        }),
      ),
    }),
  ),
  volumeChapters: optionalArray(
    objectSchema({
      volume: partRef(['comicVolume']),
      change: membershipChange(volumeChapter, partRef(['comicChapter'])),
      expected: optionalArray(
        objectSchema({
          chapter: objectSchema({ type: v.literal('comicChapter'), id: nonemptyStringSchema }),
          numberLabel: v.nullable(nonemptyStringSchema),
        }),
      ),
    }),
  ),
})
const directory = objectSchema({
  path: absolutePathSchema,
  definition: v.exactOptional(v.pipe(v.unknown(), v.transform(parseDirectoryDiscoveryDefinition))),
  recognitionProfileId: v.exactOptional(v.nullable(nonemptyStringSchema)),
})
const file = objectSchema({
  path: absolutePathSchema,
  parts: optionalArray(graphPartRef),
  isPreferred: v.exactOptional(v.boolean()),
  note: v.exactOptional(v.nullable(v.string())),
})
const localContentSchema: v.GenericSchema<unknown, GraphLocalContent> = objectSchema({
  game: optionalArray(
    objectSchema({
      work: entryRef(['game']),
      directories: optionalArray(objectSchema({ path: absolutePathSchema })),
      launchConfigs: optionalArray(v.pipe(v.unknown(), v.transform(parseGameLaunchConfigFields))),
    }),
  ),
  anime: optionalArray(
    objectSchema({
      work: entryRef(['anime']),
      directories: optionalArray(directory),
      files: optionalArray(file),
    }),
  ),
  comic: optionalArray(
    objectSchema({
      work: entryRef(['comic']),
      directories: optionalArray(directory),
      files: optionalArray(file),
    }),
  ),
  novel: optionalArray(
    objectSchema({
      work: entryRef(['novel']),
      directories: optionalArray(directory),
      files: optionalArray(file),
    }),
  ),
})
const graphSchema: v.GenericSchema<unknown, LibraryWriteGraph> = objectSchema({
  entries: v.exactOptional(
    objectSchema({
      create: optionalArray(graphEntryCreate),
      update: optionalArray(v.pipe(plainRecordSchema, v.transform(parseEntryEdit))),
    }),
  ),
  parts: v.exactOptional(
    objectSchema({
      create: optionalArray(graphPartCreate),
      update: optionalArray(v.pipe(plainRecordSchema, v.transform(parsePartEdit))),
    }),
  ),
  tags: v.exactOptional(
    objectSchema({
      create: optionalArray(graphTagCreate),
      update: optionalArray(identifiedEdit(parseTagUpdate)),
    }),
  ),
  relations: v.exactOptional(relationsSchema),
  localContent: v.exactOptional(localContentSchema),
  prepared: optionalArray(preparedAttachmentSchema),
})

function referenceKey(
  ref: { readonly key: string } | { readonly id: string; readonly type?: string },
): string {
  return 'key' in ref ? JSON.stringify(['key', ref.key]) : JSON.stringify(['id', ref.type, ref.id])
}
function requireUnique<Value>(values: readonly Value[], key: (value: Value) => string): void {
  if (!hasUniqueKeys(values, key)) {
    invalidInput('The graph contains duplicate or contradictory targets.')
  }
}

/** Parse complete intent and validate all request-local references. Actual stored identities, permissions, occupancy, and concurrency remain transactional checks. */
export function parseLibraryWriteGraph(input: unknown): LibraryWriteGraph {
  const graph = parseContract(graphSchema, input, 'library write graph')
  const entries = new Map(graph.entries?.create?.map((item) => [item.key, item]))
  const parts = new Map(graph.parts?.create?.map((item) => [item.key, item]))
  const tags = new Set(graph.tags?.create?.map((item) => item.key))
  const keys = [
    ...(graph.entries?.create ?? []),
    ...(graph.parts?.create ?? []),
    ...(graph.tags?.create ?? []),
  ]
  requireUnique(keys, (item) => item.key)
  requireUnique(graph.entries?.update ?? [], (item) => item.ref.id)
  requireUnique(graph.parts?.update ?? [], (item) => referenceKey(item.ref))
  requireUnique(graph.tags?.update ?? [], (item) => item.id)

  function entryType(ref: GraphEntryRef, allowed: readonly EntryType[]): EntryType {
    const type = 'key' in ref ? entries.get(ref.key)?.type : ref.type
    if (!type || !allowed.includes(type)) {
      return invalidInput('A graph entry reference has no matching creation or has the wrong kind.')
    }
    return type
  }
  function partType(ref: GraphPartRef, allowed: readonly PartType[]): PartType {
    const type = 'key' in ref ? parts.get(ref.key)?.type : ref.type
    if (!type || !allowed.includes(type)) {
      return invalidInput('A graph part reference has no matching creation or has the wrong kind.')
    }
    return type
  }
  function tag(ref: GraphTagRef): void {
    if ('key' in ref && !tags.has(ref.key)) {
      invalidInput('A graph tag reference has no matching creation.')
    }
  }
  for (const entry of graph.entries?.create ?? []) {
    for (const member of entry.tags ?? []) {
      tag(member.tagId)
    }
  }
  for (const part of graph.parts?.create ?? []) {
    let type: WorkType = 'anime'
    if (part.type === 'novelVolume') {
      type = 'novel'
    } else if (part.type === 'comicVolume' || part.type === 'comicChapter') {
      type = 'comic'
    }
    entryType(part.work, [type])
  }

  const relations = graph.relations
  for (const changes of [
    relations?.workCharacters,
    relations?.personWorks,
    relations?.organizationWorks,
    relations?.workRelations,
  ]) {
    if (!changes) {
      continue
    }
    requireUnique(changes.update?.map((item) => item.id) ?? [], (id) => id)
    requireUnique(changes.remove ?? [], (id) => id)
    requireUnique(changes.expected?.map((item) => item.id) ?? [], (id) => id)
    const removed = new Set(changes.remove)
    if (
      changes.update?.some((item) => removed.has(item.id)) ||
      changes.expected?.some((item) => !removed.has(item.id))
    ) {
      invalidInput('Relation edits or baselines contradict the explicit removal set.')
    }
  }
  for (const item of relations?.workCharacters?.add ?? []) {
    entryType(item.work, workTypes)
    entryType(item.character, ['character'])
  }
  for (const item of relations?.personWorks?.add ?? []) {
    const workType = parseContract(
      v.picklist(workTypes),
      entryType(item.work, workTypes),
      'graph work type',
    )
    entryType(item.person, ['person'])
    if (item.character) {
      entryType(item.character, ['character'])
    }
    if (!isPersonRoleAllowed(item.role, workType, item.character !== null)) {
      invalidInput('The graph person role does not apply to this work or character.')
    }
  }
  for (const item of relations?.organizationWorks?.add ?? []) {
    const workType = parseContract(
      v.picklist(workTypes),
      entryType(item.work, workTypes),
      'graph work type',
    )
    entryType(item.organization, ['organization'])
    if (!isOrganizationRoleAllowed(item.role, workType)) {
      invalidInput('The graph organization role does not apply to this work.')
    }
  }
  for (const item of relations?.workRelations?.add ?? []) {
    const from = {
      type: parseContract(
        v.picklist(workTypes),
        entryType(item.from, workTypes),
        'graph work type',
      ),
      id: referenceKey(item.from),
    }
    const to = {
      type: parseContract(v.picklist(workTypes), entryType(item.to, workTypes), 'graph work type'),
      id: referenceKey(item.to),
    }
    if (!isWorkRelationAllowed({ from, to, type: item.type })) {
      invalidInput('The graph work relationship is invalid.')
    }
  }
  requireUnique(relations?.workCharacters?.add ?? [], (item) =>
    JSON.stringify([referenceKey(item.work), referenceKey(item.character)]),
  )
  requireUnique(relations?.personWorks?.add ?? [], (item) =>
    JSON.stringify([
      referenceKey(item.work),
      referenceKey(item.person),
      item.character && referenceKey(item.character),
      item.role,
    ]),
  )
  requireUnique(relations?.organizationWorks?.add ?? [], (item) =>
    JSON.stringify([referenceKey(item.work), referenceKey(item.organization), item.role]),
  )
  requireUnique(relations?.workRelations?.add ?? [], (item) => {
    const normalized = normalizeWorkRelation({
      from: {
        type:
          'key' in item.from
            ? parseContract(v.picklist(workTypes), entries.get(item.from.key)?.type, 'work type')
            : item.from.type,
        id: referenceKey(item.from),
      },
      to: {
        type:
          'key' in item.to
            ? parseContract(v.picklist(workTypes), entries.get(item.to.key)?.type, 'work type')
            : item.to.type,
        id: referenceKey(item.to),
      },
      type: item.type,
    })
    return JSON.stringify([normalized.from.id, normalized.to.id, normalized.type])
  })

  requireUnique(relations?.entryTags ?? [], (item) => referenceKey(item.entry))
  const tagWrites = new Set([
    ...(graph.entries?.create ?? [])
      .filter((item) => item.tags !== undefined)
      .map((item) => referenceKey({ key: item.key })),
    ...(graph.entries?.update ?? [])
      .filter((item) => item.changes.tags !== undefined)
      .map((item) => referenceKey(item.ref)),
  ])
  for (const item of relations?.entryTags ?? []) {
    entryType(item.entry, entryTypes)
    if (tagWrites.has(referenceKey(item.entry))) {
      invalidInput('The graph writes the same entry tag scope in multiple regions.')
    }
    const added = item.change.type === 'replace' ? item.change.items : (item.change.add ?? [])
    const removed = item.change.type === 'modify' ? (item.change.remove ?? []) : []
    for (const member of added) {
      tag(member.tagId)
    }
    for (const member of removed) {
      tag(member)
    }
    validateMembership(
      added.map((member) => referenceKey(member.tagId)),
      removed.map(referenceKey),
      item.change.type,
    )
    requireUnique(item.expected ?? [], (member) => member.tagId)
    if (item.expected && item.change.type !== 'replace') {
      invalidInput('A tag baseline requires a complete replacement.')
    }
  }
  for (const removed of relations?.workCharacters?.expected ?? []) {
    if (
      relations?.personWorks?.add?.some(
        (item) =>
          item.character !== null &&
          referenceKey(item.work) === referenceKey(removed.binding.work) &&
          referenceKey(item.character) === referenceKey(removed.binding.character),
      )
    ) {
      invalidInput('The graph removes a character participation required by its new person work.')
    }
  }
  requireUnique(relations?.volumeChapters ?? [], (item) => referenceKey(item.volume))
  for (const item of relations?.volumeChapters ?? []) {
    partType(item.volume, ['comicVolume'])
    const added = item.change.type === 'replace' ? item.change.items : (item.change.add ?? [])
    const removed = item.change.type === 'modify' ? (item.change.remove ?? []) : []
    for (const member of [...added.map((value) => value.chapter), ...removed]) {
      partType(member, ['comicChapter'])
      const volume = 'key' in item.volume ? parts.get(item.volume.key) : undefined
      const chapter = 'key' in member ? parts.get(member.key) : undefined
      if (volume && chapter && referenceKey(volume.work) !== referenceKey(chapter.work)) {
        invalidInput('Graph volume members belong to another comic.')
      }
    }
    validateMembership(
      added.map((member) => referenceKey(member.chapter)),
      removed.map(referenceKey),
      item.change.type,
    )
    requireUnique(item.expected ?? [], (member) => member.chapter.id)
    if (item.expected && item.change.type !== 'replace') {
      invalidInput('A chapter baseline requires a complete replacement.')
    }
  }
  const applicableFileParts: Readonly<Record<WorkType, readonly PartType[]>> = {
    game: [],
    anime: ['animeEpisode', 'animeExtra'],
    comic: ['comicVolume', 'comicChapter'],
    novel: ['novelVolume'],
  }
  for (const type of workTypes) {
    const items = graph.localContent?.[type] ?? []
    requireUnique(
      items.map((item) => referenceKey(item.work)),
      (key) => key,
    )
    for (const item of items) {
      entryType(item.work, [type])
      requireUnique(item.directories ?? [], (directory) => directory.path)
      if ('files' in item) {
        requireUnique(item.files ?? [], (file) => file.path)
        for (const file of item.files ?? []) {
          requireUnique(file.parts ?? [], referenceKey)
          for (const ref of file.parts ?? []) {
            partType(ref, applicableFileParts[type])
            const created = 'key' in ref ? parts.get(ref.key) : undefined
            if (created && referenceKey(created.work) !== referenceKey(item.work)) {
              invalidInput('A graph file association belongs to another work.')
            }
          }
        }
      }
    }
  }
  return graph
}

function validateMembership(
  added: readonly string[],
  removed: readonly string[],
  type: 'replace' | 'modify',
): void {
  requireUnique(added, (value) => value)
  requireUnique(removed, (value) => value)
  if (
    removed.some((value) => added.includes(value)) ||
    (type === 'modify' && added.length + removed.length === 0)
  ) {
    invalidInput('The graph membership change is empty or contradictory.')
  }
}
