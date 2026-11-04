/** @fileoverview Defines call context, bounded reads and the lifetimes shared by desktop capabilities. */

import type { ErrorSummary } from './errors'
import { parseValue, intervalEntries } from './validation'
import * as v from 'valibot'

/** At least one submitted value; uniqueness and domain constraints are checked at the input boundary. */
export type NonEmptyArray<T> = readonly [T, ...T[]]

/** A nonempty range with inclusive bounds. Individual domains define units and comparison. */
export type Bounds<T> =
  { readonly min: T; readonly max?: T } | { readonly min?: T; readonly max: T }

/**
 * Request cancellation of this call; the receiving endpoint binds the actual caller instance.
 * Operations finish necessary commit or cleanup before settling and preserve completed facts.
 * Cancelling an observation or a wait only ends that call, not the work it observes.
 */
export interface CallOptions {
  readonly signal?: AbortSignal
}

/** Registration removal completes before resolve; already acquired work follows its own lifetime. */
export interface Registration<Ref> {
  readonly ref: Ref

  /**
   * Remove this instance's registration and finish its cleanup; repeated disposal has no further
   * effect.
   */
  dispose(): Promise<void>
}

/** Per-call cancellation supplied to the callee. Operation-specific choices are explicit options, never ambient policy. */
export interface ExecutionContext {
  readonly signal: AbortSignal
}

/** A release belongs to its creating instance; releasing again has no further effect. */
export interface Disposable {
  /**
   * Stop this instance's future delivery or use; await a returned promise for release
   * completion.
   */
  dispose(): void | Promise<void>
}

/** Observers receive read-only snapshots. Releasing stops future delivery, not accepted business work. */
export type Listener<T> = (value: T) => void

/** An arbitrary zero-based interval in a complete local list, limited to 200 items per call. */
export interface ListOptions {
  readonly offset: number
  readonly limit: number
}

/** Items and the deduplicated full count come from the same short read; no cross-call snapshot is implied. */
export interface ListResult<T> {
  readonly items: readonly T[]
  readonly total: number
}

/**
 * A saved execution definition can remain unreadable while the surrounding object stays usable.
 * Invalid snapshots carry a safe explanation, never raw corrupt storage or an editable repair baseline.
 */
export type StoredDefinition<T> =
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'invalid'; readonly error: ErrorSummary }

/** Validate a local interval without truncating it or treating an omitted limit as an unbounded read. */
export function parseListOptions(input: unknown): ListOptions {
  return parseValue(v.strictObject(intervalEntries), input, 'Invalid list interval')
}
