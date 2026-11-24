import { parseValue } from '../../validation'
import * as v from 'valibot'
import {
  partCountScopeSchema,
  partMeasure,
  type PartCountScope,
  type PartCountMeasure,
} from './conditions'
import { entryTypes, type EntryType } from '../catalog'
import { partWorkType } from '../parts'
import { entryFieldTypes } from './fields'
import { DesktopError } from '../../errors'

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
