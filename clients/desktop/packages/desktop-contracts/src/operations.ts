/** @fileoverview Defines call context, bounded reads and the lifetimes shared by desktop capabilities. */

import type { ErrorSummary } from './errors'
import { parseValue, intervalEntries } from './validation'
import * as v from 'valibot'

/**
 * Readonly sequence containing at least one submitted value.
 *
 * The input boundary checks uniqueness and domain-specific constraints.
 */
export type NonEmptyArray<T> = readonly [T, ...T[]]

/**
 * Range with at least one inclusive bound.
 *
 * Each domain defines the units and comparison rules.
 */
export type Bounds<T> =
  | { readonly min: T; readonly max?: T }
  | { readonly min?: T; readonly max: T }

/**
 * Optional cancellation signal for one capability call.
 *
 * The receiving endpoint binds the actual caller instance. Operations finish required commit or
 * cleanup before settling and preserve completed facts. Cancelling an observation or wait ends that
 * call while leaving observed work running.
 */
export interface CallOptions {
  readonly signal?: AbortSignal
}

/**
 * Instance-owned registration reference and asynchronous removal handle.
 *
 * Already acquired work follows its own lifetime after removal.
 */
export interface Registration<Ref> {
  readonly ref: Ref

  /**
   * Removes this instance's registration and completes its cleanup.
   *
   * Repeated disposal has no further effect.
   */
  dispose(): Promise<void>
}

/**
 * Per-call cancellation context supplied to an implementation.
 *
 * Operation-specific choices are passed as explicit input options.
 */
export interface ExecutionContext {
  readonly signal: AbortSignal
}

/** Idempotent release handle belonging to the instance that created it. */
export interface Disposable {
  /**
   * Stops this instance's future delivery or use.
   *
   * A returned promise settles when release completes.
   */
  dispose(): void | Promise<void>
}

/**
 * Observer of readonly snapshots.
 *
 * Releasing the subscription stops future delivery while leaving accepted business work running.
 */
export type Listener<T> = (value: T) => void

/** Zero-based interval in a complete local list, with a limit from 1 through 200 items. */
export interface ListOptions {
  readonly offset: number
  readonly limit: number
}

/**
 * Requested items and deduplicated full count from one short read.
 *
 * Separate calls do not share a snapshot.
 */
export interface ListResult<T> {
  readonly items: readonly T[]
  readonly total: number
}

/**
 * Result values keyed by submitted items, retaining definite tuple keys and optional membership.
 *
 * Dynamic dictionaries use ordinary indexed access. Finite keys remain optional unless a fixed
 * input tuple contains an item with that exact key.
 */
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

/**
 * Saved execution definition represented as a usable value or an explicit validation failure.
 *
 * Invalid definitions retain a safe explanation while the surrounding object stays usable. Raw
 * corrupt storage and repair baselines are not exposed.
 */
export type StoredDefinition<T> =
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'invalid'; readonly error: ErrorSummary }

/** Parses a bounded local interval, requiring an explicit valid offset and limit. */
export function parseListOptions(input: unknown): ListOptions {
  return parseValue(v.strictObject(intervalEntries), input, 'Invalid list interval')
}
