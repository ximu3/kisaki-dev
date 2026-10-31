/** @fileoverview Applies plain-record boundaries to extension document schemas without changing signed content. */

import * as v from 'valibot'

/** Validate an ordinary record and its exact fields, excluding arrays and class instances. */
export function objectSchema<Entries extends v.ObjectEntries>(
  entries: Entries,
): v.GenericSchema<unknown, v.InferOutput<v.StrictObjectSchema<Entries, undefined>>> {
  return v.pipe(v.unknown(), v.check(isPlainRecord), v.strictObject(entries))
}

/** Preserve future signed members while validating the known fields of an ordinary record. */
export function looseObjectSchema<Entries extends v.ObjectEntries>(
  entries: Entries,
): v.GenericSchema<unknown, v.InferOutput<v.LooseObjectSchema<Entries, undefined>>> {
  const checked: v.GenericSchema<
    unknown,
    {
      known: v.InferOutput<v.ObjectSchema<Entries, undefined>>
      original: [string, unknown][]
    }
  > = v.object({ known: v.object(entries), original: v.array(v.tuple([v.string(), v.unknown()])) })
  return v.pipe(
    v.custom<Record<string, unknown>>(isPlainRecord),
    v.transform((input): unknown => ({ known: input, original: Object.entries(input) })),
    checked,
    v.transform(({ known, original }) => ({ ...Object.fromEntries(original), ...known })),
  )
}

/** Validate locale maps without treating an empty array as a locale object. */
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
