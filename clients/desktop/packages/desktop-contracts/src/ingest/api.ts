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

export interface IngestBatchResult<Result> {
  readonly total: number
  readonly items: readonly (
    | { readonly index: number; readonly result: Result }
    | { readonly index: number; readonly error: ExecutionFailure<Result> }
  )[]
}

export interface IngestApi {
  add<T extends EntryType>(
    input: IngestAddInput<T>,
    call?: CallOptions,
  ): Promise<IngestAddResult<T>>

  addMany<T extends EntryType>(
    inputs: readonly IngestAddInput<T>[],
    call?: CallOptions,
  ): Promise<IngestBatchResult<IngestAddResult<T>>>

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

  updateMany<I extends IngestUpdateItem>(
    inputs: readonly I[],
    call?: CallOptions,
  ): Promise<IngestBatchResult<IngestUpdateResult<I['target']['type']>>>
}

export interface IngestExecutor {
  add<T extends EntryType>(
    input: IngestAddInput<T>,
    context: ExecutionContext,
  ): Promise<IngestAddResult<T>>

  update<I extends IngestUpdateItem>(
    input: I,
    context: ExecutionContext,
  ): Promise<IngestUpdateResult<I['target']['type']>>
}

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
