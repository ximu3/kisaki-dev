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

export interface WorkCompletion<T extends WorkType = WorkType> extends CompletionFields {
  readonly id: string
  readonly work: WorkRef<T>
  readonly createdAt: number
  readonly updatedAt: number
}

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

export type WorkStatisticsScope =
  | { readonly type: 'library'; readonly workTypes?: readonly WorkType[] }
  | { readonly type: 'works'; readonly refs: readonly WorkRef[] }

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

export interface CompletionsApi {
  list<T extends WorkType>(
    work: WorkRef<T>,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<WorkCompletion<T>>>

  get<T extends WorkType>(
    work: WorkRef<T>,
    completionId: string,
    call?: CallOptions,
  ): Promise<WorkCompletion<T> | null>

  statistics(
    query: {
      readonly scope: WorkStatisticsScope
      readonly completedDate?: DateTest
      readonly groupBy?: 'year' | 'month' | 'day'
    },
    call?: CallOptions,
  ): Promise<CompletionStatistics>

  create(work: WorkRef, input: CompletionCreate, call?: CallOptions): Promise<string>

  createMany(
    items: NonEmptyArray<CompletionCreateItem>,
    call?: CallOptions,
  ): Promise<readonly string[]>

  recordCurrent(work: WorkRef, input: CompletionCreate, call?: CallOptions): Promise<string>

  recordCurrentMany<T extends WorkType>(
    items: NonEmptyArray<CompletionCreateItem<T>>,
    call?: CallOptions,
  ): Promise<readonly { readonly work: WorkRef<T>; readonly completionId: string }[]>

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

export function parseCompletionCreate(input: unknown): CompletionCreate {
  return parseValue(v.strictObject(createEntries), input, 'Invalid completion creation')
}

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
