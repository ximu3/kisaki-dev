/** @fileoverview Applies plain-record boundaries before Valibot's field and optional-value rules. */

import * as v from 'valibot'

export const plainRecordSchema = v.custom<Record<string, unknown>>(isPlainRecord)

/** Validate an ordinary record and its exact fields; live resources have separate explicit schemas. */
export function objectSchema<Entries extends v.ObjectEntries>(
  entries: Entries,
): v.GenericSchema<unknown, v.InferOutput<v.StrictObjectSchema<Entries, undefined>>> {
  return v.pipe(v.unknown(), v.check(isPlainRecord), v.strictObject(entries))
}

/** Validate a record with dynamic string keys, rejecting arrays even when they are empty. */
export function recordSchema<Value>(
  key: v.GenericSchema<string, string>,
  value: v.GenericSchema<unknown, Value>,
): v.GenericSchema<unknown, Record<string, Value>> {
  return v.pipe(
    v.custom<Record<string, unknown>>(isPlainRecord),
    v.transform((input) => Object.entries(input)),
    v.array(v.tuple([key, value])),
    v.transform((entries) => Object.fromEntries(entries)),
  )
}

function isPlainRecord(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
