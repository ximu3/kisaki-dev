/** @fileoverview Composes complete adoption operations and validates batch result accounting. */

import type { ExecutionFailure } from '../errors'
import type { EntryType } from '../library/catalog'
import type { IngestAddInput, AddResult } from './add'
import type { CallOptions, ExecutionContext } from '../operations'
import type {
  IngestUpdateType,
  IngestUpdateRef,
  IngestUpdateInput,
  UpdateResult,
  IngestUpdateItem,
} from './update'
import * as v from 'valibot'
import { parseExecutionFailure, DesktopError } from '../errors'
import { parseValue, nonnegativeInteger, unique } from '../validation'

/** total stays the original input count; cancellation retains only actually completed item reports and their legal partial results. */
export interface IngestBatchResult<Result> {
  readonly total: number
  readonly items: readonly (
    | { readonly index: number; readonly result: Result }
    | { readonly index: number; readonly error: ExecutionFailure<Result> }
  )[]
}

/** Each operation waits for its actual end, including graph commit and applicable initial local-content verification. */
export interface IngestApi {
  add<T extends EntryType>(input: IngestAddInput<T>, call?: CallOptions): Promise<AddResult<T>>
  addMany(
    inputs: readonly IngestAddInput[],
    call?: CallOptions,
  ): Promise<IngestBatchResult<AddResult>>

  update(
    ...args: {
      [K in IngestUpdateType]: [
        target: IngestUpdateRef<K>,
        input: IngestUpdateInput<K>,
        call?: CallOptions,
      ]
    }[IngestUpdateType]
  ): Promise<UpdateResult>
  updateMany(
    inputs: readonly IngestUpdateItem[],
    call?: CallOptions,
  ): Promise<IngestBatchResult<UpdateResult>>
}

/** Native scanner/batch collaboration reuses the same complete business work inside an already admitted execution, without nested tasks. */
export interface IngestExecutor {
  add(input: IngestAddInput, context: ExecutionContext): Promise<AddResult>
  update(input: IngestUpdateItem, context: ExecutionContext): Promise<UpdateResult>
}

/** Validate complete or partial batch reporting without manufacturing failed items for work that did not start. */
export function parseIngestBatchResult<Result>(
  input: unknown,
  parseResult: (value: unknown) => Result,
  completeness: 'complete' | 'partial' = 'complete',
): IngestBatchResult<Result> {
  const result = v.pipe(v.unknown(), v.transform(parseResult))
  const failure = v.pipe(
    v.unknown(),
    v.transform((value) => parseExecutionFailure(value, parseResult)),
  )
  const value = parseValue(
    v.strictObject({
      total: nonnegativeInteger,
      items: v.array(
        v.union([
          v.strictObject({ index: nonnegativeInteger, result }),
          v.strictObject({ index: nonnegativeInteger, error: failure }),
        ]),
      ),
    }),
    input,
    'Invalid adoption batch result',
  )
  if (
    !unique(value.items, (item) => String(item.index)) ||
    value.items.some((item) => item.index >= value.total) ||
    (completeness === 'complete' && value.items.length !== value.total)
  ) {
    throw new DesktopError('InvalidInput', 'Adoption batch report has inconsistent input indices')
  }

  return value
}
