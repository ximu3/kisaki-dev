/** @fileoverview Shares internal value checks while keeping validation-library types out of public declarations. */

import * as v from 'valibot'
import { DesktopError } from './errors'
import { DistributionError } from '@kisaki3/extension-distribution/errors'

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

/**
 * Parses input with a schema and translates validation failure into InvalidInput with its local
 * cause.
 */
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

/**
 * Translates external DistributionError and TypeError parser failures into desktop InvalidInput.
 *
 * Unexpected failures propagate unchanged.
 */
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

/**
 * Creates field schemas that permit omission and validate present values with their original
 * schema.
 */
export function optionalFields<T extends v.ObjectEntries>(
  entries: T,
): { [K in keyof T]: v.ExactOptionalSchema<T[K], undefined> } {
  return Object.fromEntries(
    Object.entries(entries).map(([key, schema]) => [key, v.exactOptional(schema)]),
  ) as { [K in keyof T]: v.ExactOptionalSchema<T[K], undefined> }
}

/** Copies enumerable own string-keyed fields except the explicitly omitted names. */
export function omitFields<T extends object, K extends keyof T & string>(
  value: T,
  keys: readonly K[],
): T extends unknown ? Omit<T, K> : never {
  const omitted = new Set<string>(keys)
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !omitted.has(key)),
  ) as T extends unknown ? Omit<T, K> : never
}

/**
 * Checks a record's object and prototype shape while preserving its original properties for
 * downstream validation.
 */
export function parseRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new DesktopError('InvalidInput', 'Expected an ordinary data object')
  }

  const prototype: unknown = Object.getPrototypeOf(input)
  if (prototype !== null && Object.getPrototypeOf(prototype) !== null) {
    throw new DesktopError('InvalidInput', 'Expected an ordinary data object')
  }

  return input as Record<string, unknown>
}

/**
 * Parses dictionary entries into own data properties, preserving prototype-like names.
 *
 * Keys that collide after normalization are rejected.
 */
export function parseDictionary<T extends v.GenericSchema>(
  keys: v.GenericSchema<unknown, string>,
  values: T,
  input: unknown,
): Record<string, v.InferOutput<T>> {
  const entries = Object.entries(parseRecord(input)).map(
    ([key, value]) => [parseValue(keys, key), parseValue(values, value)] as const,
  )
  if (new Set(entries.map(([key]) => key)).size !== entries.length) {
    throw new DesktopError('InvalidInput', 'Dictionary keys collide after normalization')
  }

  return Object.fromEntries(entries)
}

/** Checks whether selected identity keys are distinct without changing item order or values. */
export function unique<T>(items: readonly T[], key: (item: T) => string): boolean {
  return new Set(items.map(key)).size === items.length
}

/**
 * Requires every expected key to belong to the submitted changes or the explicitly allowed context
 * fields.
 */
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
