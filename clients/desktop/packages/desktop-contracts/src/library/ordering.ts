/** @fileoverview Applies complete-baseline reorder and current-position move intent without losing unselected slots. */

import * as v from 'valibot'
import { DesktopError } from '../errors'
import type { NonEmptyArray } from '../operations'
import { id, parseValue, unique } from '../validation'

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

/** Apply a permutation only after the complete current order matches expected; stale scope is Conflict. */
export function reorderSubset(current: readonly string[], input: ReorderInput): readonly string[] {
  const value = parseReorderInput(input)
  if (
    current.length !== value.expected.order.length ||
    current.some((item, index) => item !== value.expected.order[index])
  ) {
    throw new DesktopError('Conflict', 'The complete order has changed')
  }
  const selected = new Set(value.order)
  if (value.order.some((item) => !current.includes(item))) {
    throw new DesktopError('Conflict', 'A reordered member is no longer in this scope')
  }
  let position = 0
  return current.map((item) => (selected.has(item) ? value.order[position++]! : item))
}

/** Apply current-position intent; missing members or anchor fail instead of shrinking the move or appending. */
export function moveWithinOrder(current: readonly string[], input: MoveInput): readonly string[] {
  const value = parseMoveInput(input)
  if (
    value.ids.some((item) => !current.includes(item)) ||
    (value.before !== null && !current.includes(value.before))
  ) {
    throw new DesktopError('InvalidReference', 'A move member or anchor is no longer in this scope')
  }
  const selected = new Set(value.ids)
  const result = current.filter((item) => !selected.has(item))
  const index = value.before === null ? result.length : result.indexOf(value.before)
  result.splice(index, 0, ...value.ids)
  return result
}
