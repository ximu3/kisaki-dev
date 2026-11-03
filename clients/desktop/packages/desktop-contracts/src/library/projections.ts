/** @fileoverview Checks type-dependent list projections and the self-consistency of interval and location replies. */

import * as v from 'valibot'
import { DesktopError, parseErrorSummary } from '../errors'
import {
  id,
  nonemptyText,
  nonnegativeInteger,
  parseValue,
  rating,
  text,
  timestamp,
  unique,
} from '../validation'
import {
  calendarDateSchema,
  entryTypes,
  genderSchema,
  languageSchema,
  measureSchema,
  partialDateSchema,
  releaseStatusSchema,
  statusSchema,
} from './catalog'
import type { EntryRef } from './catalog'
import { entryFieldTypes, entryLocateOffset } from './query'
import type {
  EntryGroupsResult,
  EntryListItem,
  EntryListOptions,
  EntryListResult,
  EntryLocateOptions,
  EntryLocateResult,
  EntryProjectionField,
  EntryQuery,
} from './query-values'

const counts = v.strictObject({
  registered: nonnegativeInteger,
  completed: nonnegativeInteger,
  withFiles: nonnegativeInteger,
  accessible: nonnegativeInteger,
})

function classifiedCounts(keys: readonly string[]) {
  return v.strictObject({
    ...counts.entries,
    byType: v.strictObject(Object.fromEntries(keys.map((key) => [key, counts]))),
  })
}

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

const date = v.nullable(partialDateSchema)
const count = v.nullable(nonnegativeInteger)

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
    originalLanguages: v.array(languageSchema),
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

/** Check exactly the requested applicable values; missing, unrequested and inapplicable properties all fail. */
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

/** Parse a same-snapshot interval reply against already parsed query/options; no shortened success is accepted. */
export function parseEntryListResult(
  input: unknown,
  query: EntryQuery,
  options: EntryListOptions,
): EntryListResult {
  const value = parseValue(
    v.strictObject({
      total: nonnegativeInteger,
      items: v.array(
        v.pipe(
          v.unknown(),
          v.transform((item) => parseEntryListItem(item, options.fields)),
        ),
      ),
    }),
    input,
    'Invalid entry list result',
  )

  const types = new Set(query.rules.filter((rule) => rule.enabled).flatMap((rule) => rule.types))
  if (
    value.items.some((item) => !types.has(item.type)) ||
    !unique(value.items, (item) => item.id) ||
    value.items.length !== Math.min(options.limit, Math.max(0, value.total - options.offset)) ||
    (types.size === 0 && value.total !== 0)
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Entry interval does not match its complete result count or type range',
    )
  }

  return value
}

/** Verify the centered interval and the real target at index; null is the sole ordinary no-match result. */
export function parseEntryLocateResult(
  input: unknown,
  query: EntryQuery,
  target: EntryRef,
  options: EntryLocateOptions,
): EntryLocateResult | null {
  if (input === null) {
    return null
  }

  const value = parseValue(
    v.strictObject({
      index: nonnegativeInteger,
      offset: nonnegativeInteger,
      total: nonnegativeInteger,
      items: v.array(v.unknown()),
    }),
    input,
    'Invalid located entry result',
  )
  const offset = entryLocateOffset(value.index, value.total, options.limit)
  if (value.offset !== offset) {
    throw new DesktopError('InvalidInput', 'Located interval has an inconsistent offset')
  }

  const interval = parseEntryListResult({ total: value.total, items: value.items }, query, {
    ...options,
    offset,
  })
  const found = interval.items[value.index - offset]
  if (!found || found.id !== target.id || found.type !== target.type) {
    throw new DesktopError(
      'InvalidInput',
      'Located interval does not contain its target at the reported index',
    )
  }

  return { ...interval, index: value.index, offset }
}

/** Preserve failed dynamic groups and the independent deduplicated total; group counts cannot be summed into total. */
export function parseEntryGroupsResult(input: unknown): EntryGroupsResult {
  const key = v.union([
    v.strictObject({ type: v.literal('collection'), id }),
    v.strictObject({ type: v.literal('unclassified') }),
  ])
  const group = v.variant('status', [
    v.strictObject({ key, status: v.literal('ready'), count: nonnegativeInteger }),
    v.strictObject({
      key,
      status: v.literal('failed'),
      error: v.pipe(v.unknown(), v.transform(parseErrorSummary)),
    }),
  ])
  const value = parseValue(
    v.strictObject({
      total: nonnegativeInteger,
      groups: v.pipe(
        v.array(group),
        v.check((groups) =>
          unique(groups, (group) =>
            group.key.type === 'collection'
              ? JSON.stringify(['collection', group.key.id])
              : 'unclassified',
          ),
        ),
      ),
    }),
    input,
    'Invalid entry groups result',
  )
  if (value.groups.at(-1)?.key.type !== 'unclassified') {
    throw new DesktopError('InvalidInput', 'Entry groups must end with the unclassified group')
  }

  return value
}
