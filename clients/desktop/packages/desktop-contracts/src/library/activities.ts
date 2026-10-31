/** @fileoverview Defines actual use intervals, manual corrections, and proportional activity statistics. */

import * as v from 'valibot'
import { invalidInput } from '../errors'
import type { CallOptions, ListOptions, ListResult } from '../execution'
import { objectSchema } from '../schema'
import {
  exactPartialEntries,
  nonemptyStringSchema,
  nonnegativeIntegerSchema,
  parseContract,
  safeIntegerSchema,
} from '../validation'
import type { EntryRef, WorkRef, WorkType } from './identity'
import type { EntryQuery } from './queries'

/** UTC millisecond boundaries and independently measured effective duration, never a session count. */
export interface ActivityInterval {
  readonly startedAt: number
  readonly endedAt: number
  readonly durationMs: number
}
/** Only known actual context is supplied; opening from a part does not establish exclusive part attribution. */
export interface ActivityContextByType {
  readonly game: { readonly launchConfigId: string | null }
  readonly anime: {
    readonly fileId: string | null
    readonly episodeId: string | null
    readonly extraId: string | null
  }
  readonly comic: {
    readonly fileId: string | null
    readonly volumeId: string | null
    readonly chapterId: string | null
  }
  readonly novel: { readonly fileId: string | null; readonly volumeId: string | null }
}
export type ActivityCreate<Type extends WorkType> = ActivityInterval & {
  readonly context?: ActivityContextByType[Type]
}
export type Activity<Type extends WorkType = WorkType> = {
  [Kind in Type]: ActivityInterval & {
    readonly id: string
    readonly work: EntryRef<Kind>
    readonly context: ActivityContextByType[Kind]
    /** Historical names are display snapshots, not identities or editable context. */
    readonly workName: string
    readonly fileName: string | null
    readonly partName: string | null
    readonly launchConfigName: string | null
  }
}[Type]
export interface ActivityUpdate<Type extends WorkType> {
  readonly changes: Partial<ActivityInterval>
  readonly expected?: {
    readonly activity: ActivityInterval & { readonly context: ActivityContextByType[Type] }
  }
}
export interface ActivityQuery {
  readonly works: EntryQuery | readonly WorkRef[]
  readonly from?: number
  readonly to?: number
  readonly fileId?: string
  readonly partId?: string
  readonly launchConfigId?: string
}
/** Period groups can contain fractional milliseconds; rounding belongs only to display. */
export interface ActivityStatistics {
  readonly durationMs: number
  readonly additionalDurationMs: number
  readonly activityCount: number
  readonly workCount: number
  readonly averageDurationMs: number | null
  readonly longestDurationMs: number | null
  readonly groups: readonly {
    readonly from: number
    readonly to: number
    readonly durationMs: number
    readonly activityCount: number
    readonly workCount: number
  }[]
}
export interface ActivitiesApi {
  /** Read ended actual facts and a matching total; references and occurrence times define the range. */
  list(
    query: ActivityQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<Activity>>
  /** Read one fact under its actual work or null, retaining historical context. */
  get<Type extends WorkType>(
    work: EntryRef<Type>,
    activityId: string,
    call?: CallOptions,
  ): Promise<Activity<Type> | null>
  /** Allocate interval overlap in the requested display zone; totals count each actual activity once. */
  statistics(
    query: ActivityQuery,
    options: {
      readonly timeZone: string
      readonly groupBy?: 'hour' | 'day' | 'week' | 'month' | 'year'
    },
    call?: CallOptions,
  ): Promise<ActivityStatistics>
  /** Add a known past interval without creating local content, completion facts, or a running session. */
  create<Type extends WorkType>(
    work: EntryRef<Type>,
    input: ActivityCreate<NoInfer<Type>>,
    call?: CallOptions,
  ): Promise<string>
  /** Correct only time values on an ended interval, comparing its complete relevant activity baseline. */
  update<Type extends WorkType>(
    work: EntryRef<Type>,
    activityId: string,
    input: ActivityUpdate<NoInfer<Type>>,
    call?: CallOptions,
  ): Promise<void>
  /** Remove the explicit ended fact; current status, completion history, and saved positions remain independent. */
  delete(work: WorkRef, activityId: string, call?: CallOptions): Promise<void>
}

const intervalFields = {
  startedAt: safeIntegerSchema,
  endedAt: safeIntegerSchema,
  durationMs: nonnegativeIntegerSchema,
}
const intervalSchema = v.pipe(
  objectSchema(intervalFields),
  v.check(
    (value) =>
      value.endedAt > value.startedAt && value.durationMs <= value.endedAt - value.startedAt,
  ),
)
const nullableId = v.nullable(nonemptyStringSchema)
const contextSchemas: {
  [Type in WorkType]: v.GenericSchema<unknown, ActivityContextByType[Type]>
} = {
  game: objectSchema({ launchConfigId: nullableId }),
  anime: v.pipe(
    objectSchema({ fileId: nullableId, episodeId: nullableId, extraId: nullableId }),
    v.check((value) => value.episodeId === null || value.extraId === null),
  ),
  comic: objectSchema({ fileId: nullableId, volumeId: nullableId, chapterId: nullableId }),
  novel: objectSchema({ fileId: nullableId, volumeId: nullableId }),
}

/** Validate a manual interval against the caller's actual submission clock; existing read facts are not retroactively changed. */
export function parseActivityCreate<Type extends WorkType>(
  type: Type,
  input: unknown,
  now: number,
): ActivityCreate<Type> {
  const context: v.GenericSchema<unknown, ActivityContextByType[Type]> = contextSchemas[type]
  const value = parseContract(
    objectSchema({ ...intervalFields, context: v.exactOptional(context) }),
    input,
    'activity creation',
  )
  parseContract(
    intervalSchema,
    { startedAt: value.startedAt, endedAt: value.endedAt, durationMs: value.durationMs },
    'activity interval',
  )
  if (value.endedAt > parseContract(safeIntegerSchema, now, 'submission time')) {
    return invalidInput('A manual activity cannot end after submission.')
  }
  return value
}
/** Validate changed times and a complete original activity baseline; the owner validates the merged interval at commit. */
export function parseActivityUpdate<Type extends WorkType>(
  type: Type,
  input: unknown,
): ActivityUpdate<Type> {
  const context: v.GenericSchema<unknown, ActivityContextByType[Type]> = contextSchemas[type]
  return parseContract(
    objectSchema({
      changes: objectSchema(exactPartialEntries(intervalFields)),
      expected: v.exactOptional(
        objectSchema({ activity: objectSchema({ ...intervalFields, context }) }),
      ),
    }),
    input,
    'activity update',
  )
}
/** Allocate effective duration to [from,to), preserving fractional precision and excluding merely touching intervals. */
export function allocateActivityDuration(
  activity: ActivityInterval,
  from: number,
  to: number,
): number {
  const interval = parseContract(intervalSchema, activity, 'activity interval')
  parseContract(safeIntegerSchema, from, 'period start')
  parseContract(safeIntegerSchema, to, 'period end')
  if (to <= from) {
    return invalidInput('An activity statistics period must be nonempty.')
  }
  const overlap = Math.max(0, Math.min(interval.endedAt, to) - Math.max(interval.startedAt, from))
  return interval.durationMs * (overlap / (interval.endedAt - interval.startedAt))
}
