import type { WorkStatisticsScope } from './completions'
import type { CalendarDate } from '../date'
import type { ListOptions, CallOptions, ListResult, NonEmptyArray } from '../operations'
import { timestamp, nonnegativeInteger, id, parseValue, text } from '../validation'
import * as v from 'valibot'
import { workRefSchema, type PartRef, type WorkType, type EntryRef, type WorkRef } from './catalog'
import { DesktopError } from '../errors'

export interface ActivityTiming {
  readonly startedAt: number
  readonly endedAt: number
  readonly durationMs: number
}

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

export type ActivityCreate = {
  [K in WorkType]: ActivityTiming & {
    readonly work: EntryRef<K>
    readonly context?: ActivityContextByType[K]
  }
}[WorkType]

export type Activity<T extends WorkType = WorkType> = {
  [K in T]: ActivityTiming & {
    readonly id: string
    readonly work: EntryRef<K>
    readonly context: ActivityContextByType[K]
    readonly contextNames: {
      readonly fileName?: string
      readonly partName?: string
      readonly launchConfigName?: string
    }
  }
}[T]

export type ActivityUpdate<K extends WorkType = WorkType> = {
  readonly changes: ActivityTiming
  readonly expected?: {
    readonly activity: ActivityTiming & { readonly context: ActivityContextByType[K] }
  }
}

export interface InstantRange {
  readonly from: number
  readonly to: number
}

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

export interface ActivitiesApi {
  list(
    query: ActivityQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<Activity>>

  get<T extends WorkType>(
    work: WorkRef<T>,
    activityId: string,
    call?: CallOptions,
  ): Promise<Activity<T> | null>

  create(input: ActivityCreate, call?: CallOptions): Promise<string>

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

  delete(work: WorkRef, ids: string | NonEmptyArray<string>, call?: CallOptions): Promise<void>

  statistics(
    query: ActivityQuery & { readonly groupBy?: 'hour' | 'day' | 'week' | 'month' | 'year' },
    call?: CallOptions,
  ): Promise<ActivityStatistics>
}

const timingEntries = { startedAt: timestamp, endedAt: timestamp, durationMs: nonnegativeInteger }

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

export function parseActivityTiming(input: unknown): ActivityTiming {
  return parseValue(timingSchema, input, 'Invalid activity timing')
}

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

export function parseActivityUpdate<T extends WorkType>(
  work: WorkRef<T>,
  input: unknown,
  submittedAt: number,
): ActivityUpdate<T>

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
