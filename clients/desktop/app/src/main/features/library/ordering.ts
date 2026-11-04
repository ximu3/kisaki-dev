/** @fileoverview Applies subset and anchored order changes against their original positions. */

import type { ReorderInput, MoveInput } from '@kisaki3/desktop-contracts/library'
import { parseReorderInput, parseMoveInput } from '@kisaki3/desktop-contracts/library'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

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
