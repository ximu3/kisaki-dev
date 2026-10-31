/** @fileoverview Validates pure public endpoint values without importing the SDK or private application code. */

import * as v from 'valibot'
import { ExecutionError } from '@kisaki3/desktop-contracts/errors'

export const nonemptyString = v.pipe(
  v.string(),
  v.check((value) => value.trim().length > 0),
)
export function objectSchema<Entries extends v.ObjectEntries>(
  entries: Entries,
): v.GenericSchema<unknown, v.InferOutput<v.StrictObjectSchema<Entries, undefined>>> {
  return v.pipe(v.unknown(), v.check(isPlainRecord), v.strictObject(entries))
}

function isPlainRecord(input: unknown): boolean {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return false
  }
  const prototype: unknown = Object.getPrototypeOf(input)
  return prototype === null || prototype === Object.prototype
}
/** Reject malformed endpoint input with a safe public classification. */
export function parse<Value>(
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
