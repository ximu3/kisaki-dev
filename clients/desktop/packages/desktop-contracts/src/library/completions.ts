import type { CalendarDate } from '../date'
import type { ListOptions, CallOptions, ListResult, NonEmptyArray } from '../operations'
import type { DateTest } from './query/conditions'
import {
  completionFieldsSchema,
  workRefSchema,
  type CompletionFields,
  type WorkRef,
  type WorkType,
} from './catalog'
import * as v from 'valibot'
import { nonnegativeInteger, parseValue, optionalFields, validateExpectedKeys } from '../validation'
import { DesktopError } from '../errors'

/** An unknown date contributes to the total but has no calendar-period allocation. */
export interface WorkCompletion<T extends WorkType = WorkType> extends CompletionFields {
  readonly id: string
  readonly work: WorkRef<T>
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
}

/** A batch compares each work's count before inserting any of its new records. */
export interface CompletionCreate extends CompletionFields {
  readonly expected?: { readonly completionCount: number }
}

export interface CompletionCreateItem<T extends WorkType = WorkType> extends CompletionCreate {
  readonly work: WorkRef<T>
}

export interface CompletionUpdate {
  readonly changes: Partial<CompletionFields>
  readonly expected?: Partial<CompletionFields>
}

/** An explicit empty kind or reference list selects no works. */
export type WorkStatisticsScope =
  | { readonly type: 'library'; readonly workTypes?: readonly WorkType[] }
  | { readonly type: 'works'; readonly refs: readonly WorkRef[] }

/** Unknown dates are counted separately within the same work scope. */
export interface CompletionStatistics {
  readonly completionCount: number
  readonly workCount: number
  readonly unknownDateCount: number
  readonly firstCompletedDate: CalendarDate | null
  readonly lastCompletedDate: CalendarDate | null

  readonly groups: readonly {
    readonly date:
      | CalendarDate
      | { readonly year: number; readonly month: number }
      | { readonly year: number }
    readonly completionCount: number
    readonly workCount: number
  }[]
}

/**
 * History operations preserve activities, positions and part marks. Only recordCurrent operations
 * also clear current work status.
 */
export interface CompletionsApi {
  /**
   * Lists the work's individual completion facts, retaining separate records with identical values.
   */
  list<T extends WorkType>(
    work: WorkRef<T>,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<WorkCompletion<T>>>

  /** Reads one completion belonging to the work, returning null when it is absent. */
  get<T extends WorkType>(
    work: WorkRef<T>,
    completionId: string,
    call?: CallOptions,
  ): Promise<WorkCompletion<T> | null>

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

  /** The count baseline is checked before insertion. The current work status stays unchanged. */
  create(work: WorkRef, input: CompletionCreate, call?: CallOptions): Promise<string>

  /**
   * Returns IDs corresponding to each input. Identical facts for the same work remain separate
   * records.
   */
  createMany(
    items: NonEmptyArray<CompletionCreateItem>,
    call?: CallOptions,
  ): Promise<readonly string[]>

  /** Adds the supplied completion fact and clears the work's current status in one transaction. */
  recordCurrent(work: WorkRef, input: CompletionCreate, call?: CallOptions): Promise<string>

  /**
   * The batch clears current status atomically. Equivalent intents for the same work coalesce.
   * Contradictory intents reject the batch.
   */
  recordCurrentMany<T extends WorkType>(
    items: NonEmptyArray<CompletionCreateItem<T>>,
    call?: CallOptions,
  ): Promise<readonly { readonly work: WorkRef<T>; readonly completionId: string }[]>

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

/** Normalizes blank notes to null while preserving other note text and unknown dates. */
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

/** Repeated works must use consistent pre-batch counts. Identical facts remain separate. */
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
