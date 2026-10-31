/** @fileoverview Defines finite mixed-kind list projections and validates the exact requested fields. */

import * as v from 'valibot'
import { objectSchema } from '../schema'
import { calendarDateSchema, partialDateSchema, type PartialDate } from '../date'
import { invalidInput } from '../errors'
import {
  nonemptyStringSchema,
  nonnegativeIntegerSchema,
  parseContract,
  safeIntegerSchema,
  type FieldSchemas,
} from '../validation'
import {
  entryMetadataFields,
  ratingSchema,
  workRecordEntries,
  type EntryMetadataByType,
  type Evaluation,
  type WorkRecord,
  type WorkSummary,
} from './catalog'
import { entryTypes, type EntryType } from './identity'
import { entryFieldTypes } from './query-fields'
import { entryGroupKeySchema, type EntryGroupKey } from './query-values'

/** The complete optional field vocabulary. id/type/name are always returned independently. */
export const entryProjectionFields = [
  'originalName',
  'sortName',
  'primaryImageId',
  'isNsfw',
  'favorite',
  'rating',
  'addedDate',
  'effectiveAddedDate',
  'createdAt',
  'updatedAt',
  'releaseDate',
  'originalLanguages',
  'status',
  'additionalDurationMs',
  'releaseStatus',
  'releaseEndDate',
  'declaredDurationMs',
  'declaredRegularEpisodeCount',
  'declaredSpecialEpisodeCount',
  'declaredPageCount',
  'declaredVolumeCount',
  'declaredChapterCount',
  'birthDate',
  'gender',
  'deathDate',
  'bloodType',
  'age',
  'height',
  'weight',
  'bust',
  'waist',
  'hips',
  'cupSize',
  'foundedDate',
  'dissolvedDate',
  'totalDurationMs',
  'lastActiveAt',
  'completionCount',
  'firstCompletedDate',
  'lastCompletedDate',
  'registeredFileCount',
  'accessibleFileCount',
  'uncheckedFileCount',
  'partCounts',
] as const
export type EntryProjectionField = (typeof entryProjectionFields)[number]

/** Counts concern actual distinct part identities, never declared totals or uploaded file counts. */
export interface PartCounts {
  readonly registered: number
  readonly completed: number
  readonly withFiles: number
  readonly accessible: number
}
const partCountFields = {
  registered: nonnegativeIntegerSchema,
  completed: nonnegativeIntegerSchema,
  withFiles: nonnegativeIntegerSchema,
  accessible: nonnegativeIntegerSchema,
}
const counts = objectSchema(partCountFields)
const fileCounts = {
  registeredFileCount: nonnegativeIntegerSchema,
  accessibleFileCount: nonnegativeIntegerSchema,
  uncheckedFileCount: nonnegativeIntegerSchema,
}
const common = {
  originalName: entryMetadataFields.game.originalName,
  sortName: entryMetadataFields.game.sortName,
  primaryImageId: entryMetadataFields.game.primaryImageId,
  isNsfw: v.boolean(),
  favorite: v.boolean(),
  rating: ratingSchema,
  addedDate: v.nullable(partialDateSchema),
  effectiveAddedDate: partialDateSchema,
  createdAt: safeIntegerSchema,
  updatedAt: safeIntegerSchema,
}
const work = {
  releaseDate: v.nullable(partialDateSchema),
  originalLanguages: entryMetadataFields.game.originalLanguages,
  ...workRecordEntries,
  totalDurationMs: nonnegativeIntegerSchema,
  lastActiveAt: v.nullable(safeIntegerSchema),
  completionCount: nonnegativeIntegerSchema,
  firstCompletedDate: v.nullable(calendarDateSchema),
  lastCompletedDate: v.nullable(calendarDateSchema),
}
const serial = {
  releaseStatus: entryMetadataFields.anime.releaseStatus,
  releaseEndDate: v.nullable(partialDateSchema),
}
const nullableCount = v.nullable(nonnegativeIntegerSchema)
const person = {
  birthDate: v.nullable(partialDateSchema),
  gender: entryMetadataFields.person.gender,
}
const character = entryMetadataFields.character
const projectionFields = {
  game: { ...common, ...work },
  anime: {
    ...common,
    ...work,
    ...serial,
    ...fileCounts,
    declaredDurationMs: nullableCount,
    declaredRegularEpisodeCount: nullableCount,
    declaredSpecialEpisodeCount: nullableCount,
    partCounts: objectSchema({
      animeEpisode: objectSchema({
        ...partCountFields,
        byType: objectSchema({ regular: counts, special: counts, unknown: counts }),
      }),
      animeExtra: objectSchema({
        ...partCountFields,
        byType: objectSchema({
          opening: counts,
          ending: counts,
          promotion: counts,
          interview: counts,
          other: counts,
          unknown: counts,
        }),
      }),
    }),
  },
  comic: {
    ...common,
    ...work,
    ...serial,
    ...fileCounts,
    declaredPageCount: nullableCount,
    declaredVolumeCount: nullableCount,
    declaredChapterCount: nullableCount,
    partCounts: objectSchema({ comicVolume: counts, comicChapter: counts }),
  },
  novel: {
    ...common,
    ...work,
    ...serial,
    ...fileCounts,
    declaredPageCount: nullableCount,
    declaredVolumeCount: nullableCount,
    partCounts: objectSchema({ novelVolume: counts }),
  },
  character: {
    ...common,
    ...person,
    bloodType: character.bloodType,
    age: character.age,
    height: character.height,
    weight: character.weight,
    bust: character.bust,
    waist: character.waist,
    hips: character.hips,
    cupSize: character.cupSize,
  },
  person: { ...common, ...person, deathDate: v.nullable(partialDateSchema) },
  organization: {
    ...common,
    foundedDate: v.nullable(partialDateSchema),
    dissolvedDate: v.nullable(partialDateSchema),
  },
} satisfies { [Type in EntryType]: FieldSchemas<EntryProjectionByType[Type]> }

/** Projection fields retain their actual type-specific meaning even in a mixed list. */
type CommonProjection = Pick<
  EntryMetadataByType['game'],
  'originalName' | 'sortName' | 'primaryImageId' | 'isNsfw' | 'addedDate'
> &
  Evaluation & {
    readonly effectiveAddedDate: PartialDate
    readonly createdAt: number
    readonly updatedAt: number
  }
type WorkProjection = Pick<EntryMetadataByType['game'], 'releaseDate' | 'originalLanguages'> &
  WorkRecord &
  WorkSummary
interface FileCounts {
  readonly registeredFileCount: number
  readonly accessibleFileCount: number
  readonly uncheckedFileCount: number
}
type SerialProjection = Pick<EntryMetadataByType['anime'], 'releaseStatus' | 'releaseEndDate'>
/** Values are associated with their entry kind, without exposing the parser's construction types. */
export interface EntryProjectionByType {
  readonly game: CommonProjection & WorkProjection
  readonly anime: CommonProjection &
    WorkProjection &
    SerialProjection &
    FileCounts &
    Pick<
      EntryMetadataByType['anime'],
      'declaredDurationMs' | 'declaredRegularEpisodeCount' | 'declaredSpecialEpisodeCount'
    > & {
      readonly partCounts: {
        readonly animeEpisode: PartCounts & {
          readonly byType: Readonly<Record<'regular' | 'special' | 'unknown', PartCounts>>
        }
        readonly animeExtra: PartCounts & {
          readonly byType: Readonly<
            Record<
              'opening' | 'ending' | 'promotion' | 'interview' | 'other' | 'unknown',
              PartCounts
            >
          >
        }
      }
    }
  readonly comic: CommonProjection &
    WorkProjection &
    SerialProjection &
    FileCounts &
    Pick<
      EntryMetadataByType['comic'],
      'declaredPageCount' | 'declaredVolumeCount' | 'declaredChapterCount'
    > & {
      readonly partCounts: { readonly comicVolume: PartCounts; readonly comicChapter: PartCounts }
    }
  readonly novel: CommonProjection &
    WorkProjection &
    SerialProjection &
    FileCounts &
    Pick<EntryMetadataByType['novel'], 'declaredPageCount' | 'declaredVolumeCount'> & {
      readonly partCounts: { readonly novelVolume: PartCounts }
    }
  readonly character: CommonProjection &
    Pick<
      EntryMetadataByType['character'],
      | 'birthDate'
      | 'gender'
      | 'bloodType'
      | 'age'
      | 'height'
      | 'weight'
      | 'bust'
      | 'waist'
      | 'hips'
      | 'cupSize'
    >
  readonly person: CommonProjection &
    Pick<EntryMetadataByType['person'], 'birthDate' | 'deathDate' | 'gender'>
  readonly organization: CommonProjection &
    Pick<EntryMetadataByType['organization'], 'foundedDate' | 'dissolvedDate'>
}
/** Unrequested or inapplicable fields are absent; requested applicable empty values use their own null/zero semantics. */
export type EntryListItem<Type extends EntryType = EntryType> = {
  [Kind in Type]: {
    readonly id: string
    readonly type: Kind
    readonly name: string
  } & Partial<EntryProjectionByType[Kind]>
}[Type]

/** Read parameters select a bounded interval and finite fields without changing the query predicate. */
export interface EntryListOptions {
  readonly offset: number
  readonly limit: number
  readonly fields?: readonly EntryProjectionField[]
  readonly group?: EntryGroupKey
}
/** Locate returns an interval centered around the actual identity, within the same query/group snapshot. */
export interface EntryLocateOptions {
  readonly limit: number
  readonly fields?: readonly EntryProjectionField[]
  readonly group?: EntryGroupKey
}
export interface EntryListResult {
  readonly items: readonly EntryListItem[]
  readonly total: number
}
export interface EntryLocateResult extends EntryListResult {
  readonly index: number
  readonly offset: number
}

const fieldSelection = v.pipe(
  v.array(v.picklist(entryProjectionFields)),
  v.transform((values) => [...new Set(values)]),
  v.readonly(),
)
const locateEntries = {
  limit: v.pipe(nonnegativeIntegerSchema, v.minValue(1), v.maxValue(200)),
  fields: v.exactOptional(fieldSelection),
  group: v.exactOptional(entryGroupKeySchema),
}

/** Validate an interval and requested field applicability against the already parsed query. */
export function parseEntryListOptions(
  input: unknown,
  enabledTypes?: readonly EntryType[],
): EntryListOptions {
  const value = parseContract(
    objectSchema({ offset: nonnegativeIntegerSchema, ...locateEntries }),
    input,
    'entry list options',
  )
  validateFields(value.fields, enabledTypes)
  return value
}

/** Validate locate's finite interval without introducing an offset or a new query identity. */
export function parseEntryLocateOptions(
  input: unknown,
  enabledTypes?: readonly EntryType[],
): EntryLocateOptions {
  const value = parseContract(objectSchema(locateEntries), input, 'entry locate options')
  validateFields(value.fields, enabledTypes)
  return value
}

/** Parse a row against the exact requested projection, rejecting extra and missing applicable fields. */
export function parseEntryListItem(
  input: unknown,
  fields: readonly EntryProjectionField[] = [],
): EntryListItem {
  const { type } = parseContract(
    v.object({ type: v.picklist(entryTypes) }),
    input,
    'entry list kind',
  )
  const available: v.ObjectEntries = projectionFields[type]
  const selected: Record<string, v.GenericSchema> = {}
  for (const field of fields) {
    const schema = available[field]
    if (schema) {
      selected[field] = schema
    }
  }
  const value = parseContract(
    objectSchema({
      id: nonemptyStringSchema,
      type: v.literal(type),
      name: nonemptyStringSchema,
      ...selected,
    }),
    input,
    'entry list item',
  )
  // The selected kind and exact requested field schemas establish this discriminated projection.
  return value as EntryListItem
}

function validateFields(
  fields: readonly EntryProjectionField[] | undefined,
  types: readonly EntryType[] | undefined,
): void {
  if (!types || !fields) {
    return
  }
  if (
    types.length > 0 &&
    fields.some((field) => !types.some((type) => entryFieldTypes(field).includes(type)))
  ) {
    invalidInput('A requested field is inapplicable to every enabled entry kind.')
  }
}
