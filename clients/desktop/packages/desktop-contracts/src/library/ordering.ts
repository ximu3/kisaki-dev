/** @fileoverview Defines explicit complete-baseline reorder and current-position move intents. */

import * as v from 'valibot'
import { objectSchema } from '../schema'
import { hasUniqueKeys, nonemptyStringSchema, parseContract } from '../validation'

/** A full or subset permutation. Expected order always covers the owner's complete original side. */
export interface OrderChange {
  readonly order: readonly [string, ...string[]]
  readonly expected: { readonly order: readonly string[] }
}

/** Move actual identities as a contiguous block; null means the current end of this owner side. */
export interface MoveInput {
  readonly ids: readonly [string, ...string[]]
  readonly before: string | null
}

const identities = v.pipe(
  v.array(nonemptyStringSchema),
  v.check((values) => hasUniqueKeys(values, (value) => value)),
  v.readonly(),
)
const nonemptyIdentities = v.pipe(
  v.tupleWithRest([nonemptyStringSchema], nonemptyStringSchema),
  v.check((values) => hasUniqueKeys(values, (value) => value)),
  v.readonly(),
)
export const orderChangeSchema = objectSchema({
  order: nonemptyIdentities,
  expected: objectSchema({ order: identities }),
})
export const moveSchema = v.pipe(
  objectSchema({ ids: nonemptyIdentities, before: v.nullable(nonemptyStringSchema) }),
  v.check((value) => value.before === null || !value.ids.includes(value.before)),
)

/** Parse a reorder intent without accepting filtered rows as proof of the complete stored baseline. */
export function parseOrderChange(value: unknown): OrderChange {
  return parseContract(orderChangeSchema, value, 'order change')
}
/** Parse a move; current existence, scope, and before-anchor validity remain transactional checks. */
export function parseMoveInput(value: unknown): MoveInput {
  return parseContract(moveSchema, value, 'move input')
}
