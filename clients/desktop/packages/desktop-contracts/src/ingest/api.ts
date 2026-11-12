/** @fileoverview Composes complete adoption operations and validates batch result accounting. */

import type { ExecutionFailure } from '../errors'
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
import { parseExecutionFailure, DesktopError } from '../errors'
import { parseValue, nonnegativeInteger, unique } from '../validation'

/**
 * Indexed outcomes for a fixed batch of adoption inputs.
 *
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

/**
 * Complete metadata adoption operations for additions and fixed-target updates.
 *
 * Each call waits for graph commit and applicable initial local-content verification.
 */
export interface IngestApi {
  /**
   * Completes identity resolution, source acquisition, preparation and creation for one input.
   *
   * An alreadyExists outcome leaves initial personal values unadopted.
   */
  add<T extends EntryType>(
    input: IngestAddInput<T>,
    call?: CallOptions,
  ): Promise<IngestAddResult<T>>

  /**
   * Runs additions with per-item commits and indexed outcomes.
   *
   * Ordinary item failure permits later items. Cancellation retains completed facts.
   */
  addMany(
    inputs: readonly IngestAddInput[],
    call?: CallOptions,
  ): Promise<IngestBatchResult<IngestAddResult>>

  /**
   * Fixes the existing target and authorized fields before acquisition and adoption.
   *
   * Source results cannot redirect the target or broaden the update.
   */
  update(
    ...args: {
      [K in IngestUpdateType]: [
        target: IngestUpdateRef<K>,
        input: IngestUpdateInput<K>,
        call?: CallOptions,
      ]
    }[IngestUpdateType]
  ): Promise<IngestUpdateResult>

  /**
   * Runs fixed-target updates with per-item commits and indexed outcomes.
   *
   * Completed items remain committed when later work fails or is cancelled.
   */
  updateMany(
    inputs: readonly IngestUpdateItem[],
    call?: CallOptions,
  ): Promise<IngestBatchResult<IngestUpdateResult>>
}

/**
 * Complete adoption work inside an already accepted native execution context.
 *
 * Scanner and batch collaboration reuse this surface without creating nested tasks.
 */
export interface IngestExecutor {
  /** Executes the complete addition within the caller's accepted execution context. */
  add(input: IngestAddInput, context: ExecutionContext): Promise<IngestAddResult>

  /** Executes the complete fixed-target update within the caller's accepted execution context. */
  update(input: IngestUpdateItem, context: ExecutionContext): Promise<IngestUpdateResult>
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
