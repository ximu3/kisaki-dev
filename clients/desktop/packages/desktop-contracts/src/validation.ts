/** @fileoverview Shares internal value checks while keeping validation-library types out of public declarations. */

import * as v from 'valibot'
import { DistributionError } from '@kisaki3/extension-distribution/errors'
import { DesktopError } from './errors'

export const text = v.pipe(
  v.string(),
  v.check((value) => !/[\uD800-\uDFFF]/u.test(value), 'Invalid Unicode'),
)
export const nonemptyText = v.pipe(
  text,
  v.check((value) => value.trim().length > 0, 'Empty text'),
)
export const id = nonemptyText
export const integer = v.pipe(v.number(), v.safeInteger())
export const nonnegativeInteger = v.pipe(integer, v.minValue(0))
export const positiveInteger = v.pipe(integer, v.minValue(1))
export const nonnegativeNumber = v.pipe(v.number(), v.finite(), v.minValue(0))
export const timestamp = v.pipe(
  integer,
  v.minValue(-8_640_000_000_000_000),
  v.maxValue(8_640_000_000_000_000),
)
export const rating = v.pipe(integer, v.minValue(0), v.maxValue(100))
export const intervalEntries = {
  offset: nonnegativeInteger,
  limit: v.pipe(positiveInteger, v.maxValue(200)),
}

/** Parse at an actual input boundary and deliver the desktop failure classification with a local cause. */
export function parseValue<T extends v.GenericSchema>(
  schema: T,
  input: unknown,
  message = 'Invalid input',
): v.InferOutput<T> {
  const result = v.safeParse(schema, input)
  if (!result.success) {
    throw new DesktopError('InvalidInput', message, { cause: new v.ValiError(result.issues) })
  }
  return result.output
}

/** Translate documented value-parser failures into the desktop category, retaining unexpected implementation failures. */
export function parseExternalValue<T>(
  parser: (input: unknown) => T,
  input: unknown,
  message: string,
): T {
  try {
    return parser(input)
  } catch (cause) {
    if (cause instanceof DistributionError || cause instanceof TypeError) {
      throw new DesktopError('InvalidInput', message, { cause })
    }
    throw cause
  }
}

/** Build optional editable fields that distinguish omission from an explicit undefined value. */
export function optionalFields<T extends v.ObjectEntries>(
  entries: T,
): { [K in keyof T]: v.ExactOptionalSchema<T[K], undefined> } {
  return Object.fromEntries(
    Object.entries(entries).map(([key, schema]) => [key, v.exactOptional(schema)]),
  ) as { [K in keyof T]: v.ExactOptionalSchema<T[K], undefined> }
}

/** Copy a parsed record without the listed structural fields, retaining every other own data key for its next strict boundary. */
export function omitFields<T extends object, K extends keyof T & string>(
  value: T,
  keys: readonly K[],
): T extends unknown ? Omit<T, K> : never {
  const omitted = new Set<string>(keys)
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !omitted.has(key)),
  ) as T extends unknown ? Omit<T, K> : never
}

/** Preserve every own data key for strict downstream checks, including names sanitized by loose-object validators. */
export function readRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new DesktopError('InvalidInput', 'Expected an ordinary data object')
  }
  const prototype: unknown = Object.getPrototypeOf(input)
  if (prototype !== null && Object.getPrototypeOf(prototype) !== null) {
    throw new DesktopError('InvalidInput', 'Expected an ordinary data object')
  }
  return input as Record<string, unknown>
}

/** Parse open string-keyed maps without dropping constructor/prototype keys or invoking prototype setters. */
export function parseDictionary<T extends v.GenericSchema>(
  keys: v.GenericSchema<unknown, string>,
  values: T,
  input: unknown,
): Record<string, v.InferOutput<T>> {
  const entries = Object.entries(readRecord(input)).map(
    ([key, value]) => [parseValue(keys, key), parseValue(values, value)] as const,
  )
  if (new Set(entries.map(([key]) => key)).size !== entries.length) {
    throw new DesktopError('InvalidInput', 'Dictionary keys collide after normalization')
  }
  return Object.fromEntries(entries)
}

/** Reject duplicated identities without sorting, trimming or otherwise changing the submitted order. */
export function unique<T>(items: readonly T[], key: (item: T) => string): boolean {
  return new Set(items.map(key)).size === items.length
}

/** Independent expected fields may only compare fields changed by this operation. */
export function validateExpectedKeys(
  changes: object,
  expected: object | undefined,
  context: readonly string[] = [],
): void {
  if (
    expected &&
    Object.keys(expected).some((key) => !Object.hasOwn(changes, key) && !context.includes(key))
  ) {
    throw new DesktopError('InvalidInput', 'Expected values must belong to the submitted save unit')
  }
}
