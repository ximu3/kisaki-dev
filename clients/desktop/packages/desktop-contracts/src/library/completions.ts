/** @fileoverview Defines explicit work completion facts, creation baselines and current-completion batch semantics. */

import * as v from 'valibot'
import type { CalendarDate } from '../date'
import { DesktopError } from '../errors'
import type { ListOptions, ListResult, NonEmptyArray, CallOptions } from '../operations'
import { nonnegativeInteger, optionalFields, parseValue, validateExpectedKeys } from '../validation'
import { completionFieldsSchema, workRefSchema } from './catalog'
import type { CompletionFields, WorkRef, WorkType } from './catalog'
import type { DateTest } from './query-values'

/** A stable one-time fact. Null date still contributes to count but not to calendar-period statistics. */
export interface WorkCompletion extends CompletionFields {
  readonly id: string
  readonly work: WorkRef
  readonly createdAt: number
  readonly updatedAt: number
}
/** The only allowed creation precondition is the work's count before any item in this batch is inserted. */
export interface CompletionCreate extends CompletionFields {
  readonly expected?: { readonly completionCount: number }
}
export interface CompletionCreateItem extends CompletionCreate {
  readonly work: WorkRef
}
export interface CompletionUpdate {
  readonly changes: Partial<CompletionFields>
  readonly expected?: Partial<CompletionFields>
}

/** A scope names actual works or the complete visible library of the selected work media. Empty types/refs mean empty. */
export type WorkStatisticsScope =
  | { readonly type: 'library'; readonly workTypes?: readonly WorkType[] }
  | { readonly type: 'works'; readonly refs: readonly WorkRef[] }

/** Counts reflect matching records and distinct owners, with unknown dates reported independently in the same work scope. */
export interface CompletionStatistics {
  readonly completionCount: number
  readonly workCount: number
  readonly unknownDateCount: number
  readonly firstCompletedDate: CalendarDate | null
  readonly lastCompletedDate: CalendarDate | null
  readonly groups: readonly {
    readonly date:
      CalendarDate | { readonly year: number; readonly month: number } | { readonly year: number }
    readonly completionCount: number
    readonly workCount: number
  }[]
}

/** Completion history does not change activities, positions or part marks. Only recordCurrent also clears current status. */
export interface CompletionsApi {
  list(work: WorkRef, options: ListOptions, call?: CallOptions): Promise<ListResult<WorkCompletion>>
  get(work: WorkRef, completionId: string, call?: CallOptions): Promise<WorkCompletion | null>
  statistics(
    query: {
      readonly scope: WorkStatisticsScope
      readonly completedDate?: DateTest
      readonly groupBy?: 'year' | 'month' | 'day'
    },
    call?: CallOptions,
  ): Promise<CompletionStatistics>
  create(work: WorkRef, input: CompletionCreate, call?: CallOptions): Promise<string>
  /** Every input is a separate fact, including identical facts for the same work; IDs correspond one-to-one. */
  createMany(
    items: NonEmptyArray<CompletionCreateItem>,
    call?: CallOptions,
  ): Promise<readonly string[]>
  /** Add the supplied fact and clear this work's current status in one transaction. */
  recordCurrent(work: WorkRef, input: CompletionCreate, call?: CallOptions): Promise<string>
  /** Equivalent duplicate work intents coalesce; contradictory duplicates reject the entire short batch. */
  recordCurrentMany(
    items: NonEmptyArray<CompletionCreateItem>,
    call?: CallOptions,
  ): Promise<readonly { readonly work: WorkRef; readonly completionId: string }[]>
  update(
    work: WorkRef,
    completionId: string,
    input: CompletionUpdate,
    call?: CallOptions,
  ): Promise<void>
  delete(work: WorkRef, completionId: string, call?: CallOptions): Promise<void>
}

const createEntries = {
  ...completionFieldsSchema.entries,
  expected: v.exactOptional(v.strictObject({ completionCount: nonnegativeInteger })),
}
const itemSchema = v.strictObject({ work: workRefSchema, ...createEntries })

/** Normalize blank notes to null and preserve all other note text; never fill an unknown date with today. */
export function parseCompletionCreate(input: unknown): CompletionCreate {
  return parseValue(v.strictObject(createEntries), input, 'Invalid completion creation')
}
/** Validate only the date/note fields actually being saved, using their original values as independent baselines. */
export function parseCompletionUpdate(input: unknown): CompletionUpdate {
  const fields = v.strictObject(optionalFields(completionFieldsSchema.entries))
  const value = parseValue(
    v.strictObject({ changes: fields, expected: v.exactOptional(fields) }),
    input,
    'Invalid completion edit',
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}

/** Parse independent history facts and require consistent pre-batch counts for every repeated work. No facts are deduplicated. */
export function parseCompletionCreateMany(input: unknown): NonEmptyArray<CompletionCreateItem> {
  const items = parseValue(
    v.tupleWithRest([itemSchema], itemSchema),
    input,
    'Invalid completion batch',
  )
  const baselines = new Map<string, number>()
  for (const item of items) {
    const key = JSON.stringify([item.work.type, item.work.id])
    if (item.expected) {
      const existing = baselines.get(key)
      if (existing !== undefined && existing !== item.expected.completionCount) {
        throw new DesktopError(
          'InvalidInput',
          'Conflicting completion count baselines for one work',
        )
      }
      baselines.set(key, item.expected.completionCount)
    }
  }
  return items
}

/** Coalesce equivalent current-completion intents by first work appearance while preserving any supplied baseline. */
export function parseRecordCurrentMany(input: unknown): NonEmptyArray<CompletionCreateItem> {
  const items = parseCompletionCreateMany(input)
  const result = new Map<string, CompletionCreateItem>()
  for (const item of items) {
    const key = JSON.stringify([item.work.type, item.work.id])
    const previous = result.get(key)
    if (
      previous &&
      (JSON.stringify(previous.completedDate) !== JSON.stringify(item.completedDate) ||
        previous.note !== item.note)
    ) {
      throw new DesktopError('InvalidInput', 'Conflicting completion actions for one work')
    }
    if (!previous || (!previous.expected && item.expected)) {
      result.set(key, item)
    }
  }
  const values = [...result.values()]
  return [values[0]!, ...values.slice(1)]
}
