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

/** Stable scalar sorting only. Null stays last in either direction; identity tie-breaks remain ascending. */
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

/** Parse a complete sort and check its field across every enabled type; no types still requires a known shape. */
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
