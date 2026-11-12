/** @fileoverview Defines permitted query ordering and validates sort applicability. */

import type { PartCountScope, PartCountMeasure } from './conditions'
import type { EntryType } from '../catalog'
import { parseValue } from '../../validation'
import * as v from 'valibot'
import { partCountScopeSchema, partMeasure } from './conditions'
import { entryTypes } from '../catalog'
import { partWorkType } from '../parts'
import { entryFieldTypes } from './fields'
import { DesktopError } from '../../errors'

/** Scalar fact supported as an entry sort key. */
export type EntrySortField =
  | 'name'
  | 'originalName'
  | 'effectiveSortName'
  | 'rating'
  | 'effectiveAddedDate'
  | 'createdAt'
  | 'updatedAt'
  | 'releaseDate'
  | 'releaseEndDate'
  | 'additionalDurationMs'
  | 'totalDurationMs'
  | 'lastActiveAt'
  | 'completionCount'
  | 'firstCompletedDate'
  | 'lastCompletedDate'
  | 'declaredDurationMs'
  | 'declaredRegularEpisodeCount'
  | 'declaredSpecialEpisodeCount'
  | 'declaredPageCount'
  | 'declaredVolumeCount'
  | 'declaredChapterCount'
  | 'birthDate'
  | 'birthMonthDay'
  | 'deathDate'
  | 'foundedDate'
  | 'dissolvedDate'
  | 'age'
  | 'height'
  | 'weight'
  | 'bust'
  | 'waist'
  | 'hips'
  | 'registeredFileCount'
  | 'accessibleFileCount'
  | 'uncheckedFileCount'

/**
 * Entry ordering inherited from the scope or specified by a scalar field or part count.
 *
 * Null values remain last in either direction, and identity tie-breaks remain ascending.
 */
export type EntrySort =
  | { readonly type: 'scope' }
  | { readonly type: 'field'; readonly field: EntrySortField; readonly direction: 'asc' | 'desc' }
  | {
      readonly type: 'parts'
      readonly scope: PartCountScope
      readonly measure: PartCountMeasure
      readonly direction: 'asc' | 'desc'
    }

/** The entire sortable scalar catalog; boolean, enum and arbitrary collection encodings have no sort meaning. */
export const entrySortFields: readonly EntrySortField[] = Object.freeze([
  'name',
  'originalName',
  'effectiveSortName',
  'rating',
  'effectiveAddedDate',
  'createdAt',
  'updatedAt',
  'releaseDate',
  'releaseEndDate',
  'additionalDurationMs',
  'totalDurationMs',
  'lastActiveAt',
  'completionCount',
  'firstCompletedDate',
  'lastCompletedDate',
  'declaredDurationMs',
  'declaredRegularEpisodeCount',
  'declaredSpecialEpisodeCount',
  'declaredPageCount',
  'declaredVolumeCount',
  'declaredChapterCount',
  'birthDate',
  'birthMonthDay',
  'deathDate',
  'foundedDate',
  'dissolvedDate',
  'age',
  'height',
  'weight',
  'bust',
  'waist',
  'hips',
  'registeredFileCount',
  'accessibleFileCount',
  'uncheckedFileCount',
])

/**
 * Parses an ordering and checks its applicability to every supplied entry type.
 *
 * An empty type list still requires a valid ordering shape.
 */
export function parseEntrySort(input: unknown, types: readonly EntryType[] = []): EntrySort {
  const sort = parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('scope') }),
      v.strictObject({
        type: v.literal('field'),
        field: v.picklist(entrySortFields),
        direction: v.picklist(['asc', 'desc']),
      }),
      v.strictObject({
        type: v.literal('parts'),
        scope: partCountScopeSchema,
        measure: partMeasure,
        direction: v.picklist(['asc', 'desc']),
      }),
    ]),
    input,
    'Invalid entry sort',
  )

  let applicable: readonly EntryType[] = entryTypes
  if (sort.type === 'parts') {
    applicable = [partWorkType(sort.scope.partType)]
  } else if (sort.type === 'field') {
    applicable = entryFieldTypes[sort.field]
  }
  if (!types.every((type) => applicable.includes(type))) {
    throw new DesktopError('InvalidInput', 'Sort is not applicable to every enabled type')
  }

  return sort
}
