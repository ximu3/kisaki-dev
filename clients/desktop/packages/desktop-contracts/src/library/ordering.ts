/** @fileoverview Defines and validates reorder requests with a complete baseline and move requests with an anchor. */

import type { NonEmptyArray } from '../operations'
import * as v from 'valibot'
import { id, unique, parseValue } from '../validation'

/** A subset permutes only its existing slots; expected always contains the complete original side. */
export interface ReorderInput<T = string> {
  readonly order: NonEmptyArray<T>
  readonly expected: { readonly order: readonly T[] }
}

/** Current-position intent, with ids moved in input order before a nonselected identity or to the end. */
export interface MoveInput<T = string> {
  readonly ids: NonEmptyArray<T>
  readonly before: T | null
}

const uniqueIds = v.pipe(
  v.tupleWithRest([id], id),
  v.check((items) => unique(items, (item) => item)),
)

/** Parse a nonempty unique order and the full original sequence; no implicit snapshot is manufactured. */
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

/** Parse a current-position move and reject a selected anchor. */
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
