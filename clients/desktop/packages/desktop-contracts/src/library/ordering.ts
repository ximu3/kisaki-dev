import type { NonEmptyArray } from '../operations'
import * as v from 'valibot'
import { id, unique, parseValue } from '../validation'

export interface ReorderInput<T = string> {
  readonly order: NonEmptyArray<T>
  readonly expected: { readonly order: readonly T[] }
}

export interface MoveInput<T = string> {
  readonly ids: NonEmptyArray<T>
  readonly before: T | null
}

const uniqueIds = v.pipe(
  v.tupleWithRest([id], id),
  v.check((items) => unique(items, (item) => item)),
)

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
