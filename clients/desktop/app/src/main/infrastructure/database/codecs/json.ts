/** @fileoverview Maps validated JSON values to SQLite text and preserves unavailable stored definitions. */

import { customType } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseJsonValue, parseStrictJson } from '@kisaki3/desktop-contracts/json'
import type { StoredDefinition } from '@kisaki3/desktop-contracts/operations'

/** A pure parser shared with the owner of a persisted value. */
export type ValueParser<T> = (input: unknown) => T

/** Creates a canonical SQL JSON-text default without serializing a decoded result wrapper. */
export function jsonLiteral(value: unknown) {
  return sql.raw(`'${JSON.stringify(parseJsonValue(value)).replaceAll("'", "''")}'`)
}

/** Reads JSON text with duplicate-key and non-finite number rejection. */
export function readJsonText(input: unknown): unknown {
  if (typeof input !== 'string') {
    throw new DesktopError('InvalidInput', 'Expected stored JSON text')
  }
  return parseStrictJson(input)
}

/** Recognizes contract validation failures without hiding unexpected parser failures. */
export function isInvalidValue(error: unknown): error is DesktopError {
  return error instanceof DesktopError && error.code === 'InvalidInput'
}

/**
 * Builds a JSON column with strict writes and a field-specific read policy.
 *
 * Direct and relational JSON projections use the same decoder. SQLite NULL remains SQL NULL.
 */
export function jsonColumn<T>(
  parse: ValueParser<T>,
  read: ValueParser<T> = (source) => parse(readJsonText(source)),
) {
  return customType<{ data: T; driverData: string; jsonData: unknown }>({
    /** Declares SQLite's durable JSON representation. */
    dataType: () => 'text',
    /** Validates the complete submitted value before serializing it. */
    toDriver: (value) => JSON.stringify(parse(value)),
    fromDriver: read,
    fromJson: read,
  })
}

/** Decodes a non-null JSON field; only invalid stored values use the supplied fallback. */
export function readWithFallback<T>(source: unknown, parse: ValueParser<T>, fallback: () => T): T {
  try {
    return parse(readJsonText(source))
  } catch (error) {
    if (!isInvalidValue(error)) {
      throw error
    }
    return fallback()
  }
}

/**
 * Decodes an executable definition or historical value without inventing a replacement.
 *
 * The original text remains in SQLite; the safe failure can accompany the surrounding record.
 */
export function readStoredDefinition<T>(
  source: unknown,
  parse: ValueParser<T>,
): StoredDefinition<T> {
  try {
    return { status: 'ready', value: parse(readJsonText(source)) }
  } catch (error) {
    if (!isInvalidValue(error)) {
      throw error
    }
    return {
      status: 'invalid',
      error: { code: 'DataIntegrityError', message: 'The stored value is invalid' },
    }
  }
}

/** Wraps a validated value for insertion into a stored-definition column. */
export function ready<T>(value: T): StoredDefinition<T> {
  return { status: 'ready', value }
}

/** Creates a strict JSON column whose reads explicitly distinguish unusable stored definitions. */
export function storedJsonColumn<T>(parse: ValueParser<T>) {
  return customType<{ data: StoredDefinition<T>; driverData: string; jsonData: unknown }>({
    /** Stores the definition itself as JSON text. */
    dataType: () => 'text',
    /** Rejects invalid read projections and validates the explicit replacement. */
    toDriver(value) {
      if (value.status !== 'ready') {
        throw new DesktopError('InvalidInput', 'Cannot save an invalid stored definition')
      }
      return JSON.stringify(parse(value.value))
    },
    /** Preserves direct-read validity without rewriting the stored text. */
    fromDriver: (source) => readStoredDefinition(source, parse),
    /** Applies the same validity contract inside relational JSON projections. */
    fromJson: (source) => readStoredDefinition(source, parse),
  })
}
