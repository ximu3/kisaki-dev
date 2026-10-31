/** @fileoverview Defines explicit work completion facts, count baselines, and coherent calendar statistics. */

import * as v from 'valibot'
import { calendarDateSchema, type CalendarDate } from '../date'
import { invalidInput } from '../errors'
import type { CallOptions, ListOptions, ListResult } from '../execution'
import { objectSchema } from '../schema'
import {
  exactPartialEntries,
  hasRelatedExpected,
  nonnegativeIntegerSchema,
  parseContract,
} from '../validation'
import { workRefSchema, type WorkRef } from './identity'
import type { EntryQuery } from './queries'
import type { DateTest } from './query-values'

/** One actual recorded completion, even when its date and note are both unknown. */
export interface CompletionRecord {
  readonly id: string
  readonly work: WorkRef
  readonly completedDate: CalendarDate | null
  readonly note: string | null
  readonly createdAt: number
  readonly updatedAt: number
}
/** A new fact compares only its work's original count when that precondition was explicitly requested. */
export interface CompletionCreate {
  readonly completedDate: CalendarDate | null
  readonly note: string | null
  readonly expected?: { readonly completionCount: number }
}
/** Each batch item keeps its own actual work and count precondition. */
export interface CompletionCreateItem extends CompletionCreate {
  readonly work: WorkRef
}
/** An existing fact's date and note are independent edit units; IDs and timestamps are never editable. */
export interface CompletionUpdate {
  readonly changes: { readonly completedDate?: CalendarDate | null; readonly note?: string | null }
  readonly expected?: {
    readonly completedDate?: CalendarDate | null
    readonly note?: string | null
  }
}
/** Explicit work selection and calendar grouping; unknown dates are counted separately from the period. */
export interface CompletionStatisticsQuery {
  readonly works: EntryQuery | readonly WorkRef[]
  readonly completedDate?: DateTest
  readonly groupBy?: 'day' | 'month' | 'year'
}
/** Counts reflect distinct stored facts and distinct works, not inferred playthroughs. */
export interface CompletionStatistics {
  readonly completionCount: number
  readonly workCount: number
  readonly unknownDateCount: number
  readonly firstCompletedDate: CalendarDate | null
  readonly lastCompletedDate: CalendarDate | null
  readonly groups: readonly {
    readonly date: CalendarDate
    readonly completionCount: number
    readonly workCount: number
  }[]
}

/** Complete history operations; create and recordCurrent intentionally have different status effects. */
export interface CompletionsApi {
  /** Read a bounded work history and total; unknown dates sort after known dates. */
  list(
    work: WorkRef,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<CompletionRecord>>
  /** Read one matching fact or null without fabricating a date. */
  get(work: WorkRef, completionId: string, call?: CallOptions): Promise<CompletionRecord | null>
  /** Count the specified facts and calendar groups from one coherent read snapshot. */
  statistics(query: CompletionStatisticsQuery, call?: CallOptions): Promise<CompletionStatistics>
  /** Add a history fact and retain the current work status. */
  create(work: WorkRef, input: CompletionCreate, call?: CallOptions): Promise<string>
  /** Commit the entire short batch, preserving input order and genuine repeated facts. */
  createMany(
    items: readonly [CompletionCreateItem, ...CompletionCreateItem[]],
    call?: CallOptions,
  ): Promise<readonly string[]>
  /** Add a completion and clear the current status in the same transaction. */
  recordCurrent(work: WorkRef, input: CompletionCreate, call?: CallOptions): Promise<string>
  /** Deduplicate identical work intents; conflicting values for one work reject the whole batch. */
  recordCurrentMany(
    items: readonly [CompletionCreateItem, ...CompletionCreateItem[]],
    call?: CallOptions,
  ): Promise<readonly { readonly work: WorkRef; readonly completionId: string }[]>
  /** Edit the named fact against only the changed fields' original values. */
  update(
    work: WorkRef,
    completionId: string,
    input: CompletionUpdate,
    call?: CallOptions,
  ): Promise<void>
  /** Delete this fact; status, part marks, file positions, and actual activities remain independent. */
  delete(work: WorkRef, completionId: string, call?: CallOptions): Promise<void>
}

export const completionFields = {
  completedDate: v.nullable(calendarDateSchema),
  note: v.pipe(
    v.nullable(v.string()),
    v.transform((value) => (value === null || value.trim() === '' ? null : value)),
  ),
}
export const completionCreateSchema: v.GenericSchema<unknown, CompletionCreate> = objectSchema({
  ...completionFields,
  expected: v.exactOptional(objectSchema({ completionCount: nonnegativeIntegerSchema })),
})

/** Parse one explicit historical fact without substituting today's date or deduplicating equal facts. */
export function parseCompletionCreate(input: unknown): CompletionCreate {
  return parseContract(completionCreateSchema, input, 'completion creation')
}
/** Parse a complete short batch and reject inconsistent pre-batch count assumptions. */
export function parseCompletionBatch(
  input: unknown,
  mode: 'history' | 'current',
): readonly [CompletionCreateItem, ...CompletionCreateItem[]] {
  const item = objectSchema({
    work: workRefSchema,
    ...completionFields,
    expected: v.exactOptional(objectSchema({ completionCount: nonnegativeIntegerSchema })),
  })
  const items = parseContract(v.tupleWithRest([item], item), input, 'completion batch')
  const counts = new Map<string, number>()
  const current = new Map<string, CompletionCreateItem>()
  for (const value of items) {
    const key = JSON.stringify([value.work.type, value.work.id])
    if (value.expected) {
      if (counts.has(key) && counts.get(key) !== value.expected.completionCount) {
        return invalidInput('Conflicting completion count baselines.')
      }
      counts.set(key, value.expected.completionCount)
    }
    const previous = current.get(key)
    if (
      mode === 'current' &&
      previous &&
      (JSON.stringify(previous.completedDate) !== JSON.stringify(value.completedDate) ||
        previous.note !== value.note)
    ) {
      return invalidInput('Conflicting current-completion intents.')
    }
    if (!previous) {
      current.set(key, value)
    }
  }
  if (mode === 'history') {
    return items
  }
  const normalized = [...current.entries()].map(([key, value]) => {
    const count = counts.get(key)
    return count === undefined ? value : { ...value, expected: { completionCount: count } }
  })
  return [normalized[0]!, ...normalized.slice(1)]
}
/** Parse independent date/note changes and their corresponding complete original values. */
export function parseCompletionUpdate(input: unknown): CompletionUpdate {
  const fields = objectSchema(exactPartialEntries(completionFields))
  return parseContract(
    v.pipe(
      objectSchema({ changes: fields, expected: v.exactOptional(fields) }),
      v.check((value) => hasRelatedExpected(value.changes, value.expected)),
    ),
    input,
    'completion update',
  )
}
