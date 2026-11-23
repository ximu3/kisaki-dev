import type { EntryType } from '../library/catalog'
import type { IngestAddInput, IngestAddResult } from './add'
import type { CallOptions, ExecutionContext } from '../operations'
import type {
  IngestUpdateType,
  IngestUpdateRef,
  IngestUpdateInput,
  IngestUpdateResult,
  IngestUpdateItem,
} from './update'
import * as v from 'valibot'
import { parseExecutionFailure, DesktopError, type ExecutionFailure } from '../errors'
import { fromParser, parseValue, nonnegativeInteger, unique } from '../validation'

/**
 * Total retains the original input count. Cancellation reports only completed items and their legal
 * partial results.
 */
export interface IngestBatchResult<Result> {
  readonly total: number
  readonly items: readonly (
    | { readonly index: number; readonly result: Result }
    | { readonly index: number; readonly error: ExecutionFailure<Result> }
  )[]
}

/** Each call waits for graph commit and applicable initial local-content verification. */
export interface IngestApi {
  /**
   * Prepares and commits a new entry. Matching an existing identity leaves initial personal values
   * unadopted.
   */
  add<T extends EntryType>(
    input: IngestAddInput<T>,
    call?: CallOptions,
  ): Promise<IngestAddResult<T>>

  /**
   * Commits each item separately. Item failure permits later items; cancellation retains completed
   * outcomes.
   */
  addMany<T extends EntryType>(
    inputs: readonly IngestAddInput<T>[],
    call?: CallOptions,
  ): Promise<IngestBatchResult<IngestAddResult<T>>>

  /** Source results cannot redirect the target or broaden the update. */
  update<
    Args extends {
      [K in IngestUpdateType]: [
        target: IngestUpdateRef<K>,
        input: IngestUpdateInput<K>,
        call?: CallOptions,
      ]
    }[IngestUpdateType],
  >(
    ...args: Args
  ): Promise<IngestUpdateResult<Args[0]['type']>>

  /**
   * Commits fixed targets independently. Later failure or cancellation preserves earlier commits.
   */
  updateMany<I extends IngestUpdateItem>(
    inputs: readonly I[],
    call?: CallOptions,
  ): Promise<IngestBatchResult<IngestUpdateResult<I['target']['type']>>>
}

/** Scanner and batch collaboration reuse this surface without creating nested tasks. */
export interface IngestExecutor {
  /** Executes the complete addition within the caller's accepted execution context. */
  add<T extends EntryType>(
    input: IngestAddInput<T>,
    context: ExecutionContext,
  ): Promise<IngestAddResult<T>>

  /** Executes the complete fixed-target update within the caller's accepted execution context. */
  update<I extends IngestUpdateItem>(
    input: I,
    context: ExecutionContext,
  ): Promise<IngestUpdateResult<I['target']['type']>>
}

/**
 * Parses batch outcomes with unique, in-range input indices.
 *
 * Complete mode requires one outcome per input. Partial mode accepts the actual subset without
 * manufacturing unstarted-item failures.
 */
export function parseIngestBatchResult<Result>(
  input: unknown,
  parseResult: (value: unknown) => Result,
  completeness: 'complete' | 'partial' = 'complete',
): IngestBatchResult<Result> {
  const result = fromParser(parseResult)
  const failure = fromParser((value) => parseExecutionFailure(value, parseResult))
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
