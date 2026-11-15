/** @fileoverview Defines and validates reorder requests with a complete baseline and move requests with an anchor. */

import type { NonEmptyArray } from '../operations'
import * as v from 'valibot'
import { id, unique, parseValue } from '../validation'

/**
 * A selected subset's new slot order and the complete original-side baseline.
 *
 * Only the subset's existing slots are permuted.
 */
export interface ReorderInput<T = string> {
  readonly order: NonEmptyArray<T>
  readonly expected: { readonly order: readonly T[] }
}

/** Current-position intent, with ids moved in input order before a nonselected identity or to the end. */
export interface MoveInput<T = string> {
  readonly ids: NonEmptyArray<T>
  readonly before: T | null
}

/** A nonempty ordered identity sequence that rejects repeated members. */
const uniqueIds = v.pipe(
  v.tupleWithRest([id], id),
  v.check((items) => unique(items, (item) => item)),
)

/** Parses a nonempty unique requested order and an explicit unique original-order baseline. */
export function parseReorderInput(input: unknown): ReorderInput {
  return parseValue(
    v.strictObject({
      order: uniqueIds,
      expected: v.strictObject({
        order: v.pipe(
          v.array(id),
          v.check((items) => unique(items, (item) => item)),
        ),
      }),
    }),
    input,
    'Invalid reorder input',
  )
}

/** Parses a current-position move and rejects an anchor included among the moved identities. */
export function parseMoveInput(input: unknown): MoveInput {
  return parseValue(
    v.pipe(
      v.strictObject({ ids: uniqueIds, before: v.nullable(id) }),
      v.check((value) => value.before === null || !value.ids.includes(value.before)),
    ),
    input,
    'Invalid move input',
  )
}
