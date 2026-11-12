/** @fileoverview Defines explicit work completion facts, creation baselines and current-completion batch semantics. */

import type { CompletionFields, WorkRef, WorkType } from './catalog'
import type { CalendarDate } from '../date'
import type { ListOptions, CallOptions, ListResult, NonEmptyArray } from '../operations'
import type { DateTest } from './query/conditions'
import { completionFieldsSchema, workRefSchema } from './catalog'
import * as v from 'valibot'
import { nonnegativeInteger, parseValue, optionalFields, validateExpectedKeys } from '../validation'
import { DesktopError } from '../errors'

/** A stable one-time fact. Null date still contributes to count but not to calendar-period statistics. */
export interface WorkCompletion extends CompletionFields {
  readonly id: string
  readonly work: WorkRef
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
}

/**
 * One completion fact with an optional pre-insertion count comparison.
 *
 * Batch baselines use the work's count before any item in that batch is inserted.
 */
export interface CompletionCreate extends CompletionFields {
  readonly expected?: { readonly completionCount: number }
}

/** A completion-creation input paired with its actual owning work for a batch. */
export interface CompletionCreateItem extends CompletionCreate {
  readonly work: WorkRef
}

/** Changes to a saved completion's date or note with independent expected values. */
export interface CompletionUpdate {
  readonly changes: Partial<CompletionFields>
  readonly expected?: Partial<CompletionFields>
}

/**
 * Actual work identities or the visible library filtered by work kind.
 *
 * Explicit empty kind or reference arrays select no works.
 */
export type WorkStatisticsScope =
  | { readonly type: 'library'; readonly workTypes?: readonly WorkType[] }
  | { readonly type: 'works'; readonly refs: readonly WorkRef[] }

/**
 * Matching completion counts, distinct work counts and calendar groups.
 *
 * Unknown dates are reported independently within the same work scope.
 */
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

/**
 * Saved completion history and explicit recording of current completion.
 *
 * History operations preserve activities, positions and part marks. Only recordCurrent operations
 * also clear current work status.
 */
export interface CompletionsApi {
  /**
   * Lists the work's individual completion facts, retaining separate records with identical values.
   */
  list(work: WorkRef, options: ListOptions, call?: CallOptions): Promise<ListResult<WorkCompletion>>

  /** Reads one completion belonging to the work, returning null when it is absent. */
  get(work: WorkRef, completionId: string, call?: CallOptions): Promise<WorkCompletion | null>

  /**
   * Counts matching records and distinct works, reporting unknown dates outside calendar groups.
   */
  statistics(
    query: {
      readonly scope: WorkStatisticsScope
      readonly completedDate?: DateTest
      readonly groupBy?: 'year' | 'month' | 'day'
    },
    call?: CallOptions,
  ): Promise<CompletionStatistics>

  /**
   * Commits one historical completion after the optional count comparison.
   *
   * The work's current status remains unchanged.
   */
  create(work: WorkRef, input: CompletionCreate, call?: CallOptions): Promise<string>

  /**
   * Creates a separate completion fact for every input and returns corresponding IDs.
   *
   * Identical facts for the same work remain separate records.
   */
  createMany(
    items: NonEmptyArray<CompletionCreateItem>,
    call?: CallOptions,
  ): Promise<readonly string[]>

  /** Adds the supplied completion fact and clears the work's current status in one transaction. */
  recordCurrent(work: WorkRef, input: CompletionCreate, call?: CallOptions): Promise<string>

  /**
   * Records current completion and clears status for the selected works atomically.
   *
   * Equivalent duplicate work intents coalesce; contradictory duplicates reject the batch.
   */
  recordCurrentMany(
    items: NonEmptyArray<CompletionCreateItem>,
    call?: CallOptions,
  ): Promise<readonly { readonly work: WorkRef; readonly completionId: string }[]>

  /** Compares and corrects submitted fact fields while preserving identity and owning work. */
  update(
    work: WorkRef,
    completionId: string,
    input: CompletionUpdate,
    call?: CallOptions,
  ): Promise<void>

  /**
   * Removes one completion fact while preserving activities, part marks, position and current
   * status.
   */
  delete(work: WorkRef, completionId: string, call?: CallOptions): Promise<void>
}

const createEntries = {
  ...completionFieldsSchema.entries,
  expected: v.exactOptional(v.strictObject({ completionCount: nonnegativeInteger })),
}

const itemSchema = v.strictObject({ work: workRefSchema, ...createEntries })

/**
 * Parses a completion fact and optional count baseline.
 *
 * Blank notes normalize to null; other note text and unknown dates remain unchanged.
 */
export function parseCompletionCreate(input: unknown): CompletionCreate {
  return parseValue(v.strictObject(createEntries), input, 'Invalid completion creation')
}

/** Parses completion field changes and restricts expected values to those same fields. */
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

/**
 * Parses separate history facts and requires consistent pre-batch counts for repeated works.
 *
 * Identical facts are retained.
 */
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
