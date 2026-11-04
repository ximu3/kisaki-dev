/** @fileoverview Describes actual activity intervals and preserves their occurrence context during ordinary edits. */

import type { PartRef, WorkType, EntryRef, WorkRef } from './catalog'
import type { WorkStatisticsScope } from './completions'
import type { CalendarDate } from '../date'
import type { ListOptions, CallOptions, ListResult, NonEmptyArray } from '../operations'
import { timestamp, nonnegativeNumber, id, parseValue, text } from '../validation'
import * as v from 'valibot'
import { workRefSchema } from './catalog'
import { DesktopError } from '../errors'

/** UTC millisecond interval with a separately recorded effective duration; overlapping records are not unioned. */
export interface ActivityTiming {
  /** UTC milliseconds since the Unix epoch. */
  readonly startedAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly endedAt: number
  readonly durationMs: number
}

/** Context is recorded only when known. A compound file does not create multiple part-level activities. */
export interface ActivityContextByType {
  readonly game: { readonly launchConfigId: string | null }

  readonly anime: {
    readonly fileId: string | null
    readonly part: PartRef<'animeEpisode' | 'animeExtra'> | null
  }

  readonly comic: {
    readonly fileId: string | null
    readonly part: PartRef<'comicVolume' | 'comicChapter'> | null
  }

  readonly novel: { readonly fileId: string | null; readonly part: PartRef<'novelVolume'> | null }
}

/** A manually supplied actual fact; the executor verifies current ownership and endedAt <= its submission time. */
export type ActivityCreate = {
  [K in WorkType]: ActivityTiming & {
    readonly work: EntryRef<K>
    readonly context?: ActivityContextByType[K]
  }
}[WorkType]

/** Stable identity and historical display values survive later ordinary renaming or removal of the referenced context. */
export type Activity = {
  [K in WorkType]: ActivityTiming & {
    readonly id: string
    readonly work: EntryRef<K>
    readonly context: ActivityContextByType[K]
    readonly contextNames: {
      readonly fileName?: string
      readonly partName?: string
      readonly launchConfigName?: string
    }
  }
}[WorkType]

/** Editing the interval compares all timing and actual original context but cannot rewrite that context. */
export type ActivityUpdate<K extends WorkType = WorkType> = {
  readonly changes: ActivityTiming
  readonly expected?: {
    readonly activity: ActivityTiming & { readonly context: ActivityContextByType[K] }
  }
}

/** UTC milliseconds since the Unix epoch; the interval includes from and excludes to. */
export interface InstantRange {
  readonly from: number
  readonly to: number
}

/** Context filters deliberately exclude unallocated work-level additional duration. */
export type ActivityFilter =
  | { readonly type: 'work'; readonly work: WorkRef }
  | { readonly type: 'launchConfig'; readonly gameId: string; readonly launchConfigId: string }
  | {
      readonly type: 'file'
      readonly work: EntryRef<'anime' | 'comic' | 'novel'>
      readonly fileId: string
    }
  | { readonly type: 'part'; readonly part: PartRef }

export interface ActivityQuery {
  readonly scope: WorkStatisticsScope
  readonly range?: InstantRange
  readonly context?: ActivityFilter
}

/** Allocated durations retain fractional precision. Record totals cannot be obtained by summing day record counts. */
export interface ActivityStatistics {
  readonly activityCount: number
  readonly durationMs: number
  readonly additionalDurationMs: number
  readonly averageDurationMs: number | null
  readonly longestDurationMs: number | null
  readonly activeDayCount: number
  readonly longestStreakDays: number

  readonly groups: readonly {
    readonly date: CalendarDate
    readonly hour?: number
    readonly durationMs: number
    readonly activityCount: number
  }[]

  readonly works: readonly {
    readonly work: WorkRef
    readonly durationMs: number
    readonly activityCount: number
  }[]
}

/** Managed active intervals must end before manual editing/deletion; ordinary operations never control a session. */
export interface ActivitiesApi {
  /**
   * Read saved activity records in the requested work/time/context scope; work-level additional
   * duration is not a record.
   */
  list(
    query: ActivityQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<Activity>>

  /**
   * Read one saved activity belonging to the supplied work; the active session remains a
   * separate runtime object.
   */
  get(work: WorkRef, activityId: string, call?: CallOptions): Promise<Activity | null>

  /**
   * Record an explicit valid past interval and its actual context; this does not start a session
   * or infer missing history.
   */
  create(input: ActivityCreate, call?: CallOptions): Promise<string>

  /**
   * Compare and correct a saved activity after any managed interval has ended; additional
   * duration and reading position stay unchanged.
   */
  update(
    ...args: {
      [K in WorkType]: [
        work: EntryRef<K>,
        activityId: string,
        input: ActivityUpdate<K>,
        call?: CallOptions,
      ]
    }[WorkType]
  ): Promise<void>

  /**
   * Delete only the supplied saved activities after managed use has ended; never stop a session
   * or adjust additional duration.
   */
  delete(work: WorkRef, ids: string | NonEmptyArray<string>, call?: CallOptions): Promise<void>

  /**
   * Aggregate saved intervals using the requested scope and calendar grouping; undated
   * additional duration has no period allocation.
   */
  statistics(
    query: ActivityQuery & { readonly groupBy?: 'hour' | 'day' | 'week' | 'month' | 'year' },
    call?: CallOptions,
  ): Promise<ActivityStatistics>
}

const timingEntries = { startedAt: timestamp, endedAt: timestamp, durationMs: nonnegativeNumber }

const timingSchema = v.pipe(
  v.strictObject(timingEntries),
  v.check(
    (value) =>
      value.startedAt < value.endedAt && value.durationMs <= value.endedAt - value.startedAt,
  ),
)

const contexts = {
  game: v.strictObject({ launchConfigId: v.nullable(id) }),

  anime: v.strictObject({
    fileId: v.nullable(id),
    part: v.nullable(v.strictObject({ type: v.picklist(['animeEpisode', 'animeExtra']), id })),
  }),

  comic: v.strictObject({
    fileId: v.nullable(id),
    part: v.nullable(v.strictObject({ type: v.picklist(['comicVolume', 'comicChapter']), id })),
  }),

  novel: v.strictObject({
    fileId: v.nullable(id),
    part: v.nullable(v.strictObject({ type: v.literal('novelVolume'), id })),
  }),
}

/** Validate timing without applying a wall-clock rule to historical reads or automatic recordings. */
export function parseActivityTiming(input: unknown): ActivityTiming {
  return parseValue(timingSchema, input, 'Invalid activity timing')
}

/** Validate a manual creation against an explicitly supplied submission time; no implicit Date.now is used. */
export function parseActivityCreate(input: unknown, submittedAt: number): ActivityCreate {
  const { work } = parseValue(v.looseObject({ work: workRefSchema }), input)
  const value = parseValue(
    v.strictObject({
      work: workRefSchema,
      ...timingEntries,
      context: v.exactOptional(contexts[work.type]),
    }),
    input,
    'Invalid activity creation',
  )
  parseActivityTiming({
    startedAt: value.startedAt,
    endedAt: value.endedAt,
    durationMs: value.durationMs,
  })
  if (value.endedAt > parseValue(timestamp, submittedAt)) {
    throw new DesktopError('InvalidInput', 'Manual activity cannot end in the future')
  }

  return value as ActivityCreate
}

/** Validate the complete timing save unit and original context. An ordinary edit cannot replace source context. */
export function parseActivityUpdate(
  work: WorkRef,
  input: unknown,
  submittedAt: number,
): ActivityUpdate {
  const type = parseValue(workRefSchema, work).type
  const value = parseValue(
    v.strictObject({
      changes: timingSchema,
      expected: v.exactOptional(
        v.strictObject({ activity: v.strictObject({ ...timingEntries, context: contexts[type] }) }),
      ),
    }),
    input,
    'Invalid activity edit',
  )
  if (value.changes.endedAt > parseValue(timestamp, submittedAt)) {
    throw new DesktopError('InvalidInput', 'Manual activity cannot end in the future')
  }

  return value
}

/** Validate bounded historical labels independently from the current referenced names. */
export function parseActivityContextNames(input: unknown): Activity['contextNames'] {
  return parseValue(
    v.strictObject({
      fileName: v.exactOptional(text),
      partName: v.exactOptional(text),
      launchConfigName: v.exactOptional(text),
    }),
    input,
  )
}
