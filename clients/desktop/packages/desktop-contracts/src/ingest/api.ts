/** @fileoverview Defines explicit local adoption, bounded field intentions, and honest single-item and batch outcomes. */

import * as v from 'valibot'
import { invalidInput, type ExecutionFailure } from '../errors'
import type { CallOptions } from '../execution'
import { initialEntries, workInitialEntries, type EntryCreateInput } from '../library/catalog'
import type { LocalContentInput } from '../library/holdings'
import type {
  EntryRef,
  EntryType,
  ExternalIdentity,
  PartRef,
  PartType,
  WorkType,
} from '../library/identity'
import type { PartWorkType } from '../library/parts'
import {
  parseMetadataInput,
  parseMetadataUpdateInput,
  type MetadataInput,
  type MetadataUpdateInput,
} from '../metadata/api'
import {
  metadataEntryFields,
  metadataPartFields,
  type MetadataEntryField,
  type MetadataPartField,
} from '../metadata/fields'
import {
  scopeFields,
  personScopeConditionFields,
  validateScopeContext,
  type MetadataRelation,
  type MetadataRelationAttributes,
  type MetadataRelationKey,
  type MetadataRelationScopeValues,
  type MetadataScopeConditions,
} from '../metadata/relations'
import { absolutePathSchema } from '../paths'
import { objectSchema } from '../schema'
import { exactPartialEntries, nonemptyStringSchema, parseContract } from '../validation'
import type { IngestIssue } from './issues'

export type AdoptionMode = 'fill' | 'overwrite'
export type IngestAddInput<Type extends EntryType = EntryType> = {
  [Kind in Type]: {
    readonly entryType: Kind
    readonly metadata: MetadataInput<Kind>
    readonly initial?: Pick<EntryCreateInput<Kind>, 'evaluation'> &
      (Kind extends WorkType
        ? Pick<EntryCreateInput<Kind & WorkType>, 'record' | 'completionRecords'>
        : object)
  } & (Kind extends WorkType
    ? {
        readonly localContent?: LocalContentInput &
          (Kind extends 'game' ? object : { readonly recognitionProfileId?: string | null })
      }
    : object)
}[Type]
/** Already-existing identity matching never adopts initial private values or silently registers content. */
export type AddResult<Type extends EntryType = EntryType> =
  | {
      readonly outcome: 'added'
      readonly entry: EntryRef<Type>
      readonly issues: readonly IngestIssue[]
    }
  | {
      readonly outcome: 'alreadyExists'
      readonly entry: EntryRef<Type>
      readonly matchedIdentities: readonly [ExternalIdentity, ...ExternalIdentity[]]
      readonly issues: readonly IngestIssue[]
    }
export type IngestUserScopeValues = Omit<MetadataRelationScopeValues, 'personWorks'> & {
  readonly personWorks:
    | 'all'
    | readonly (MetadataScopeConditions['personWorks'] & {
        readonly characters?: readonly (EntryRef<'character'> | null)[]
      })[]
}
export type IngestRelationAdoption<Key extends MetadataRelation> = Key extends
  'workVolumes' | 'workChapters' | 'workEpisodes' | 'workExtras'
  ? { readonly mode: 'append' }
  : {
      readonly mode: 'update' | 'append' | 'replace'
      readonly fields?: Partial<Record<MetadataRelationAttributes[Key], AdoptionMode>>
    } & (Key extends keyof IngestUserScopeValues
      ? { readonly scope?: IngestUserScopeValues[Key] }
      : object)
export type IngestRelations<Type extends EntryType> = {
  readonly [Key in MetadataRelationKey<Type>]?: IngestRelationAdoption<Key>
}
export type IngestUpdateInput<Type extends EntryType | PartType> = Type extends EntryType
  ? {
      readonly metadata: MetadataUpdateInput<Type>
      readonly fields?: Partial<Record<MetadataEntryField<Type>, AdoptionMode>>
      readonly relations?: IngestRelations<Type>
    }
  : Type extends PartType
    ? {
        readonly metadata: MetadataUpdateInput<PartWorkType<Type>>
        readonly fields?: Partial<Record<MetadataPartField<Type>, AdoptionMode>>
      } & (Type extends 'comicVolume'
        ? {
            readonly relations?: {
              readonly volumeChapters?: IngestRelationAdoption<'volumeChapters'>
            }
          }
        : object)
    : never
export interface UpdateResult {
  readonly outcome: 'updated' | 'unchanged'
  readonly target: EntryRef | PartRef
  readonly issues: readonly IngestIssue[]
}
/** Each item keeps the input index and either its actual result or complete safe failure, including legal partial facts. */
export interface IngestBatchResult<Result> {
  readonly total: number
  readonly items: readonly (
    | { readonly index: number; readonly result: Result }
    | { readonly index: number; readonly error: ExecutionFailure<Result> }
  )[]
}
export type IngestUpdateItem =
  | {
      [Type in EntryType]: {
        readonly target: EntryRef<Type>
        readonly input: IngestUpdateInput<Type>
      }
    }[EntryType]
  | {
      [Type in PartType]: {
        readonly target: PartRef<Type>
        readonly input: IngestUpdateInput<Type>
      }
    }[PartType]
export interface IngestApi {
  /** Acquire/adopt one new root and its complete initial facts atomically; alreadyExists never rewrites them. */
  add<Type extends EntryType>(
    input: IngestAddInput<Type>,
    call?: CallOptions,
  ): Promise<AddResult<Type>>
  /** Fix the local target and apply only selected fields/relations; empty intent returns unchanged without acquisition. */
  update<Type extends EntryType | PartType>(
    target: { readonly type: Type; readonly id: string },
    input: IngestUpdateInput<NoInfer<Type>>,
    call?: CallOptions,
  ): Promise<UpdateResult>
  /** Process in original input order, continuing after individual failures; cancellation retains only actually processed items. */
  addMany(
    input: readonly IngestAddInput[],
    call?: CallOptions,
  ): Promise<IngestBatchResult<AddResult>>
  /** Fix every target before work, commit complete items independently, and report actual input-index outcomes. */
  updateMany(
    input: readonly IngestUpdateItem[],
    call?: CallOptions,
  ): Promise<IngestBatchResult<UpdateResult>>
}

const localContent = objectSchema({
  type: v.picklist(['directory', 'file']),
  path: absolutePathSchema,
  recognitionProfileId: v.exactOptional(v.nullable(nonemptyStringSchema)),
})
const gameContent = objectSchema({
  type: v.picklist(['directory', 'file']),
  path: absolutePathSchema,
})
const personal = objectSchema({ evaluation: initialEntries.evaluation })
const workPersonal = objectSchema({ evaluation: initialEntries.evaluation, ...workInitialEntries })
function addFields<Type extends EntryType>(type: Type) {
  return {
    entryType: v.literal(type),
    metadata: v.pipe(
      v.unknown(),
      v.transform((value) => parseMetadataInput(type, value)),
    ),
  }
}
const addSchema: v.GenericSchema<unknown, IngestAddInput> = v.union([
  objectSchema({
    ...addFields('game'),
    initial: v.exactOptional(workPersonal),
    localContent: v.exactOptional(gameContent),
  }),
  objectSchema({
    ...addFields('anime'),
    initial: v.exactOptional(workPersonal),
    localContent: v.exactOptional(localContent),
  }),
  objectSchema({
    ...addFields('comic'),
    initial: v.exactOptional(workPersonal),
    localContent: v.exactOptional(localContent),
  }),
  objectSchema({
    ...addFields('novel'),
    initial: v.exactOptional(workPersonal),
    localContent: v.exactOptional(localContent),
  }),
  objectSchema({ ...addFields('character'), initial: v.exactOptional(personal) }),
  objectSchema({ ...addFields('person'), initial: v.exactOptional(personal) }),
  objectSchema({ ...addFields('organization'), initial: v.exactOptional(personal) }),
])
/** Validate the root, acquisition branch, applicable private initial values, and explicit local input before admission. */
export function parseIngestAddInput(input: unknown): IngestAddInput {
  const value = parseContract(addSchema, input, 'ingest add input')
  if (
    'localContent' in value &&
    value.localContent &&
    value.localContent.type === 'file' &&
    'recognitionProfileId' in value.localContent
  ) {
    return invalidInput('A loose file cannot select a directory recognition profile.')
  }
  return value
}
function fieldAdoption<Entries extends v.ObjectEntries>(fields: Entries) {
  return objectSchema(
    v.entriesFromList(
      v.keyof(v.strictObject(fields)).options,
      v.exactOptional(v.picklist(['fill', 'overwrite'])),
    ),
  )
}
const personScope = v.union([
  v.literal('all'),
  v.pipe(
    v.array(
      v.pipe(
        objectSchema({
          ...exactPartialEntries(personScopeConditionFields),
          characters: v.exactOptional(
            v.pipe(
              v.array(
                v.nullable(
                  objectSchema({ type: v.literal('character'), id: nonemptyStringSchema }),
                ),
              ),
              v.minLength(1),
              v.check(
                (items) => new Set(items.map((item) => item?.id ?? null)).size === items.length,
              ),
              v.readonly(),
            ),
          ),
        }),
        v.check(
          (value) =>
            Object.keys(value).length > 0 &&
            !(value.character === 'none' && value.characters?.some((item) => item !== null)) &&
            !(value.character === 'present' && value.characters?.includes(null)),
        ),
      ),
    ),
    v.minLength(1),
    v.readonly(),
  ),
])
function relationAdoption<Field extends string, Scope>(
  fields: readonly Field[],
  scope: v.GenericSchema<unknown, Scope>,
) {
  return objectSchema({
    mode: v.picklist(['update', 'append', 'replace']),
    fields: v.exactOptional(
      objectSchema(v.entriesFromList(fields, v.exactOptional(v.picklist(['fill', 'overwrite'])))),
    ),
    scope: v.exactOptional(scope),
  })
}
const adoptionFields = {
  workCharacters: v.exactOptional(
    relationAdoption(['role', 'note', 'isSpoiler'], scopeFields.workCharacters),
  ),
  personWorks: v.exactOptional(relationAdoption(['note', 'isSpoiler'], personScope)),
  organizationWorks: v.exactOptional(
    relationAdoption(['note', 'isSpoiler'], scopeFields.organizationWorks),
  ),
  workRelations: v.exactOptional(relationAdoption(['note'], scopeFields.workRelations)),
  entryTags: v.exactOptional(relationAdoption(['note', 'isSpoiler'], scopeFields.entryTags)),
  volumeChapters: v.exactOptional(relationAdoption(['numberLabel'], scopeFields.volumeChapters)),
  workVolumes: v.exactOptional(objectSchema({ mode: v.literal('append') })),
  workChapters: v.exactOptional(objectSchema({ mode: v.literal('append') })),
  workEpisodes: v.exactOptional(objectSchema({ mode: v.literal('append') })),
  workExtras: v.exactOptional(objectSchema({ mode: v.literal('append') })),
}
const relationObject = v.strictObject(adoptionFields)
const relationSchemas: { [Type in EntryType]: v.GenericSchema<unknown, IngestRelations<Type>> } = {
  game: objectSchema(
    v.omit(relationObject, [
      'volumeChapters',
      'workVolumes',
      'workChapters',
      'workEpisodes',
      'workExtras',
    ]).entries,
  ),
  anime: objectSchema(
    v.omit(relationObject, ['volumeChapters', 'workVolumes', 'workChapters']).entries,
  ),
  comic: objectSchema(v.omit(relationObject, ['workEpisodes', 'workExtras']).entries),
  novel: objectSchema(
    v.omit(relationObject, ['volumeChapters', 'workChapters', 'workEpisodes', 'workExtras'])
      .entries,
  ),
  character: objectSchema(
    v.pick(relationObject, ['workCharacters', 'personWorks', 'entryTags']).entries,
  ),
  person: objectSchema(v.pick(relationObject, ['personWorks', 'entryTags']).entries),
  organization: objectSchema(v.pick(relationObject, ['organizationWorks', 'entryTags']).entries),
}

/** Validate a relation selection in its root context. Scope grants local modification and does not assert source completeness. */
export function parseIngestRelations<Type extends EntryType>(
  type: Type,
  input: unknown,
): IngestRelations<Type> {
  const value = parseContract(relationSchemas[type], input, 'ingest relations')
  const scopes: IngestRelations<EntryType> = value
  for (const key of [
    'workCharacters',
    'personWorks',
    'organizationWorks',
    'workRelations',
    'entryTags',
    'volumeChapters',
  ] as const) {
    const scope = scopes[key]?.scope
    if (key !== 'personWorks' && scope !== undefined) {
      validateScopeContext(type, { [key]: scope })
    }
  }
  const people = scopes.personWorks?.scope
  if (people) {
    const conditions =
      people === 'all'
        ? people
        : people.map((condition) => {
            if (!condition.characters || condition.character !== undefined) {
              return condition
            }
            if (condition.characters.every((character) => character === null)) {
              return { ...condition, character: 'none' as const }
            }
            if (condition.characters.every((character) => character !== null)) {
              return { ...condition, character: 'present' as const }
            }
            return condition
          })
    validateScopeContext(type, { personWorks: conditions })
  }
  if (
    type === 'character' &&
    people &&
    people !== 'all' &&
    people.some((condition) => condition.characters?.includes(null))
  ) {
    return invalidInput('A character update cannot select work without a character.')
  }
  return value
}

function updateEntrySchema<Type extends EntryType, Fields extends v.ObjectEntries>(
  type: Type,
  fields: Fields,
) {
  return objectSchema({
    metadata: v.pipe(
      v.unknown(),
      v.transform((value) => parseMetadataUpdateInput(type, value)),
    ),
    fields: v.exactOptional(fieldAdoption(fields)),
    relations: v.exactOptional(
      v.pipe(
        v.unknown(),
        v.transform((value) => parseIngestRelations(type, value)),
      ),
    ),
  })
}
function updatePartSchema<Type extends WorkType, Fields extends v.ObjectEntries>(
  type: Type,
  fields: Fields,
) {
  return objectSchema({
    metadata: v.pipe(
      v.unknown(),
      v.transform((value) => parseMetadataUpdateInput(type, value)),
    ),
    fields: v.exactOptional(fieldAdoption(fields)),
  })
}
const updateSchemas: {
  [Type in EntryType | PartType]: v.GenericSchema<unknown, IngestUpdateInput<Type>>
} = {
  game: updateEntrySchema('game', metadataEntryFields.game),
  anime: updateEntrySchema('anime', metadataEntryFields.anime),
  comic: updateEntrySchema('comic', metadataEntryFields.comic),
  novel: updateEntrySchema('novel', metadataEntryFields.novel),
  character: updateEntrySchema('character', metadataEntryFields.character),
  person: updateEntrySchema('person', metadataEntryFields.person),
  organization: updateEntrySchema('organization', metadataEntryFields.organization),
  animeEpisode: updatePartSchema('anime', metadataPartFields.animeEpisode),
  animeExtra: updatePartSchema('anime', metadataPartFields.animeExtra),
  comicChapter: updatePartSchema('comic', metadataPartFields.comicChapter),
  novelVolume: updatePartSchema('novel', metadataPartFields.novelVolume),
  comicVolume: objectSchema({
    metadata: v.pipe(
      v.unknown(),
      v.transform((value) => parseMetadataUpdateInput('comic', value)),
    ),
    fields: v.exactOptional(fieldAdoption(metadataPartFields.comicVolume)),
    relations: v.exactOptional(
      objectSchema({
        volumeChapters: v.exactOptional(
          objectSchema({
            mode: v.picklist(['update', 'append', 'replace']),
            fields: v.exactOptional(
              objectSchema({ numberLabel: v.exactOptional(v.picklist(['fill', 'overwrite'])) }),
            ),
            scope: v.exactOptional(v.literal('all')),
          }),
        ),
      }),
    ),
  }),
}
/** Validate exact selected fields and root/part relation scope without expanding the request or fetching metadata. */
export function parseIngestUpdateInput<Type extends EntryType | PartType>(
  type: Type,
  input: unknown,
): IngestUpdateInput<Type> {
  return parseContract(updateSchemas[type], input, 'ingest update input')
}
