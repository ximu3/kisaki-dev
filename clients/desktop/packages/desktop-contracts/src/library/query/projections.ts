/** @fileoverview Defines requested projection fields and validates their entry-specific result shapes. */

import * as v from 'valibot'
import {
  nonnegativeInteger,
  text,
  id,
  rating,
  timestamp,
  parseValue,
  nonemptyText,
} from '../../validation'
import {
  languagesSchema,
  partialDateSchema,
  statusSchema,
  releaseStatusSchema,
  genderSchema,
  measureSchema,
  calendarDateSchema,
  entryTypes,
} from '../catalog'
import { entryFieldTypes } from './fields'
import type { PartialDate, CalendarDate } from '../../date'
import type {
  LanguageTag,
  WorkStatus,
  ReleaseStatus,
  AnimeEpisodeType,
  AnimeExtraType,
  Gender,
  BloodType,
  CharacterMeasure,
  EntryType,
} from '../catalog'
import type { EntryQuery } from './definition'
import { DesktopError } from '../../errors'

/** Complete nonnegative counts for registered, completed, associated and accessible parts. */
const counts = v.strictObject({
  registered: nonnegativeInteger,
  completed: nonnegativeInteger,
  withFiles: nonnegativeInteger,
  accessible: nonnegativeInteger,
})

/**
 * Creates a part-count schema with totals and a required breakdown for each supplied
 * classification.
 */
function classifiedCounts(keys: readonly string[]) {
  return v.strictObject({
    ...counts.entries,
    byType: v.strictObject(Object.fromEntries(keys.map((key) => [key, counts]))),
  })
}

/** Per-medium part-count projections, including explicit unknown anime classifications. */
const partCountSchemas = {
  anime: v.strictObject({
    animeEpisode: classifiedCounts(['regular', 'special', 'unknown']),
    animeExtra: classifiedCounts([
      'opening',
      'ending',
      'promotion',
      'interview',
      'other',
      'unknown',
    ]),
  }),
  comic: v.strictObject({ comicVolume: counts, comicChapter: counts }),
  novel: v.strictObject({ novelVolume: counts }),
}

/** Optional partial civil date used by catalog projections. */
const date = v.nullable(partialDateSchema)

/** Optional nonnegative safe count used by declared catalog projections. */
const count = v.nullable(nonnegativeInteger)

/** Validators for individually requested scalar and resource projection fields. */
const fieldSchemas: Readonly<Record<Exclude<EntryProjectionField, 'partCounts'>, v.GenericSchema>> =
  {
    originalName: v.nullable(text),
    sortName: v.nullable(text),
    primaryImageId: v.nullable(id),

    isNsfw: v.boolean(),
    favorite: v.boolean(),
    rating: v.nullable(rating),

    addedDate: date,
    effectiveAddedDate: partialDateSchema,
    createdAt: timestamp,
    updatedAt: timestamp,

    releaseDate: date,
    originalLanguages: languagesSchema,
    status: v.nullable(statusSchema),
    additionalDurationMs: nonnegativeInteger,

    releaseStatus: v.nullable(releaseStatusSchema),
    releaseEndDate: date,
    declaredDurationMs: count,
    declaredRegularEpisodeCount: count,
    declaredSpecialEpisodeCount: count,
    declaredPageCount: count,
    declaredVolumeCount: count,
    declaredChapterCount: count,

    birthDate: date,
    gender: v.nullable(genderSchema),
    deathDate: date,
    bloodType: v.nullable(v.picklist(['a', 'b', 'ab', 'o'])),
    age: v.nullable(measureSchema),
    height: v.nullable(measureSchema),
    weight: v.nullable(measureSchema),
    bust: v.nullable(measureSchema),
    waist: v.nullable(measureSchema),
    hips: v.nullable(measureSchema),
    cupSize: v.nullable(text),

    foundedDate: date,
    dissolvedDate: date,

    totalDurationMs: nonnegativeInteger,
    lastActiveAt: v.nullable(timestamp),
    completionCount: nonnegativeInteger,
    firstCompletedDate: v.nullable(calendarDateSchema),
    lastCompletedDate: v.nullable(calendarDateSchema),

    registeredFileCount: nonnegativeInteger,
    accessibleFileCount: nonnegativeInteger,
    uncheckedFileCount: nonnegativeInteger,
  }

/**
 * Parses an entry identity and exactly its requested, applicable projection fields.
 *
 * Rejects missing required values and any unrequested or inapplicable property.
 */
export function parseEntryListItem(
  input: unknown,
  fields: readonly EntryProjectionField[] = [],
): EntryListItem {
  const { type } = parseValue(
    v.looseObject({ type: v.picklist(entryTypes) }),
    input,
    'Invalid entry projection',
  )

  const selected: Record<string, v.GenericSchema> = {}
  for (const field of fields) {
    if (!entryFieldTypes[field].includes(type)) {
      continue
    }
    if (field === 'partCounts') {
      if (type === 'anime' || type === 'comic' || type === 'novel') {
        selected[field] = partCountSchemas[type]
      }
    } else {
      selected[field] = fieldSchemas[field]
    }
  }

  return parseValue(
    v.strictObject({ ...selected, id, type: v.literal(type), name: nonemptyText }),
    input,
    'Invalid entry projection',
  ) as EntryListItem
}

/**
 * Separate counts of registered parts, completion marks, file associations and saved accessible
 * observations.
 */
export interface PartCounts {
  readonly registered: number
  readonly completed: number
  readonly withFiles: number
  readonly accessible: number
}

/** Projectable identity metadata, user marks and dates shared by all entry types. */
interface CommonProjection {
  readonly originalName: string | null
  readonly sortName: string | null
  readonly primaryImageId: string | null

  readonly isNsfw: boolean
  readonly favorite: boolean
  readonly rating: number | null

  readonly addedDate: PartialDate | null
  readonly effectiveAddedDate: PartialDate
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
}

/** Projectable release, activity and completion facts shared by works. */
interface WorkProjection {
  readonly releaseDate: PartialDate | null
  readonly originalLanguages: readonly LanguageTag[]
  readonly status: WorkStatus | null

  readonly additionalDurationMs: number
  readonly totalDurationMs: number
  /** UTC milliseconds since the Unix epoch. */
  readonly lastActiveAt: number | null
  readonly completionCount: number
  readonly firstCompletedDate: CalendarDate | null
  readonly lastCompletedDate: CalendarDate | null
}

/** Projectable publication and registered-file facts shared by anime, comics and novels. */
interface MediaProjection {
  readonly releaseStatus: ReleaseStatus | null
  readonly releaseEndDate: PartialDate | null

  readonly registeredFileCount: number
  readonly accessibleFileCount: number
  readonly uncheckedFileCount: number
}

/**
 * Available projection fields and their value types for each entry kind.
 *
 * List items include only requested fields applicable to their kind. Anime count breakdowns use the
 * read-only unknown key for unspecified classifications.
 */
export interface EntryProjectionByType {
  readonly game: CommonProjection & WorkProjection

  readonly anime: CommonProjection &
    WorkProjection &
    MediaProjection & {
      readonly declaredDurationMs: number | null
      readonly declaredRegularEpisodeCount: number | null
      readonly declaredSpecialEpisodeCount: number | null
      readonly partCounts: {
        readonly animeEpisode: PartCounts & {
          readonly byType: Readonly<Record<AnimeEpisodeType | 'unknown', PartCounts>>
        }
        readonly animeExtra: PartCounts & {
          readonly byType: Readonly<Record<AnimeExtraType | 'unknown', PartCounts>>
        }
      }
    }

  readonly comic: CommonProjection &
    WorkProjection &
    MediaProjection & {
      readonly declaredPageCount: number | null
      readonly declaredVolumeCount: number | null
      readonly declaredChapterCount: number | null
      readonly partCounts: { readonly comicVolume: PartCounts; readonly comicChapter: PartCounts }
    }

  readonly novel: CommonProjection &
    WorkProjection &
    MediaProjection & {
      readonly declaredPageCount: number | null
      readonly declaredVolumeCount: number | null
      readonly partCounts: { readonly novelVolume: PartCounts }
    }

  readonly character: CommonProjection & {
    readonly birthDate: PartialDate | null
    readonly gender: Gender | null
    readonly bloodType: BloodType | null

    readonly age: CharacterMeasure | null
    readonly height: CharacterMeasure | null
    readonly weight: CharacterMeasure | null
    readonly bust: CharacterMeasure | null
    readonly waist: CharacterMeasure | null
    readonly hips: CharacterMeasure | null
    readonly cupSize: string | null
  }

  readonly person: CommonProjection & {
    readonly birthDate: PartialDate | null
    readonly deathDate: PartialDate | null
    readonly gender: Gender | null
  }

  readonly organization: CommonProjection & {
    readonly foundedDate: PartialDate | null
    readonly dissolvedDate: PartialDate | null
  }
}

/** Selectable field name from any supported entry projection. */
export type EntryProjectionField = { [K in EntryType]: keyof EntryProjectionByType[K] }[EntryType]

/**
 * Entry identity with the requested subset of fields applicable to its kind.
 *
 * Unrequested fields are omitted; null retains its field-specific meaning.
 */
export type EntryListItem = {
  [K in EntryType]: { readonly id: string; readonly type: K; readonly name: string } & Partial<
    EntryProjectionByType[K]
  >
}[EntryType]

/** Requested list columns are bounded scalar facts and summaries, never arbitrary relation expansions or full bodies. */
export const entryProjectionFields: readonly EntryProjectionField[] = Object.freeze([
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
])

/**
 * Rejects a requested field unsupported by every enabled query type.
 *
 * Queries with no enabled types permit any declared projection field because their result set is
 * empty.
 */
export function checkProjection(
  fields: readonly EntryProjectionField[] | undefined,
  query: EntryQuery,
): void {
  const types = query.rules.filter((rule) => rule.enabled).flatMap((rule) => rule.types)
  if (
    types.length > 0 &&
    fields?.some((field) => !types.some((type) => entryFieldTypes[field].includes(type)))
  ) {
    throw new DesktopError(
      'InvalidInput',
      'A requested field is not applicable to any enabled type',
    )
  }
}

/** Supported projection fields deduplicated in their first requested order. */
export const projectionSchema = v.pipe(
  v.array(v.picklist(entryProjectionFields)),
  v.transform((fields) => [...new Set(fields)]),
)
