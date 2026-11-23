import type { ErrorSummary } from './errors'
import { parseValue, intervalEntries } from './validation'
import * as v from 'valibot'

export type NonEmptyArray<T> = readonly [T, ...T[]]

/** Both bounds are inclusive. */
export type Bounds<T> =
  | { readonly min: T; readonly max?: T }
  | { readonly min?: T; readonly max: T }

/**
 * The endpoint binds the caller's actual instance. Operations finish their commit or cleanup before
 * settling, and completed work stays in effect. Cancelling a wait or observation leaves the
 * underlying work running.
 */
export interface CallOptions {
  readonly signal?: AbortSignal
}

/** Previously acquired work keeps its own lifetime after removal. */
export interface Registration<Ref> {
  readonly ref: Ref

  /** Idempotent. Resolves when removal and cleanup finish. */
  dispose(): Promise<void>
}

export interface ExecutionContext {
  readonly signal: AbortSignal
}

export interface Disposable {
  /** Idempotent. An asynchronous release settles after cleanup. */
  dispose(): void | Promise<void>
}

export type Listener<T> = (value: T) => void

/** Zero-based interval in a complete local list, with a limit from 1 through 200 items. */
export interface ListOptions {
  readonly offset: number
  readonly limit: number
}

/**
 * The items cover the requested interval. The total counts distinct matches across the entire
 * query in the same read. Separate calls can observe different snapshots.
 */
export interface ListResult<T> {
  readonly items: readonly T[]
  readonly total: number
}

/** A fixed tuple guarantees its requested keys. A dynamic list can omit any finite key. */
export type KeyedResult<
  Items extends readonly { readonly key: string }[] | undefined,
  Values extends object,
> = string extends keyof Values
  ? Values
  : Items extends readonly { readonly key: string }[]
    ? number extends Items['length']
      ? Partial<Values>
      : Partial<Values> & {
          readonly [
            K in keyof Values as Extract<Items[number], { readonly key: K }> extends never
              ? never
              : K
          ]-?: Values[K]
        }
    : Partial<Values>

/** An invalid field retains a safe explanation. The rest of the record stays usable. */
export type StoredDefinition<T> =
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'invalid'; readonly error: ErrorSummary }

export function parseListOptions(input: unknown): ListOptions {
  return parseValue(v.strictObject(intervalEntries), input, 'Invalid list interval')
}
