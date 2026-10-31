/** @fileoverview Shares internal schema parsing and scalar constraints across desktop values. */

import * as v from 'valibot'
import { ExecutionError } from './errors'

export const nonemptyStringSchema = v.pipe(
  v.string(),
  v.check((value) => value.trim().length > 0),
)
export const safeIntegerSchema = v.pipe(v.number(), v.safeInteger())
export const nonnegativeIntegerSchema = v.pipe(safeIntegerSchema, v.minValue(0))
export const nonnegativeNumberSchema = v.pipe(v.number(), v.finite(), v.minValue(0))

/** Parse one boundary value and report its safe classification without retaining rejected input. */
export function parseContract<Value>(
  schema: v.GenericSchema<unknown, Value>,
  input: unknown,
  subject: string,
): Value {
  const result = v.safeParse(schema, input)
  if (!result.success) {
    throw new ExecutionError({ code: 'InvalidInput', message: `Invalid ${subject}.` })
  }
  return result.output
}

/** Associate each declared business field with its parser's actual output type. */
export type FieldSchemas<Value> = {
  readonly [Key in keyof Value]-?: v.GenericSchema<unknown, Value[Key]>
}

/** Compare exact identities without trimming, case folding, or changing their order. */
export function hasUniqueKeys<Value>(
  values: readonly Value[],
  key: (value: Value) => string,
): boolean {
  return new Set(values.map(key)).size === values.length
}

/** Build exact optional fields from explicitly writable fields, never from read projections. */
export function exactPartialEntries<Entries extends v.ObjectEntries>(
  entries: Entries,
): { [Key in keyof Entries]: v.ExactOptionalSchema<Entries[Key], undefined> } {
  return Object.fromEntries(
    Object.entries(entries).map(([key, schema]) => [key, v.exactOptional(schema)]),
  ) as { [Key in keyof Entries]: v.ExactOptionalSchema<Entries[Key], undefined> }
}

/** Check independent field baselines. Grouped baselines are validated by their owning operation. */
export function hasRelatedExpected(
  changes: object,
  expected: object | undefined,
  contextual: readonly string[] = [],
): boolean {
  return (
    expected === undefined ||
    Object.keys(expected).every((key) => Object.hasOwn(changes, key) || contextual.includes(key))
  )
}
