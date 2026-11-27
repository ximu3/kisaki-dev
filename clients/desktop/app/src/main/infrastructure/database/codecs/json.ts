import { customType } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseJsonValue, parseStrictJson } from '@kisaki3/desktop-contracts/json'
import type { StoredValue } from '@kisaki3/desktop-contracts/operations'

export type ValueParser<T> = (input: unknown) => T

export function jsonLiteral(value: unknown) {
  return sql.raw(`'${JSON.stringify(parseJsonValue(value)).replaceAll("'", "''")}'`)
}

export function readJsonText(input: unknown): unknown {
  if (typeof input !== 'string') {
    throw new DesktopError('InvalidInput', 'Expected stored JSON text')
  }
  return parseStrictJson(input)
}

export function isInvalidValue(error: unknown): error is DesktopError {
  return error instanceof DesktopError && error.code === 'InvalidInput'
}

export function jsonColumn<T>(
  parse: ValueParser<T>,
  read: ValueParser<T> = (source) => parse(readJsonText(source)),
) {
  return customType<{ data: T; driverData: string; jsonData: unknown }>({
    dataType: () => 'text',
    toDriver: (value) => JSON.stringify(parse(value)),
    fromDriver: read,
    fromJson: read,
  })
}

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

export function readStoredValue<T>(source: unknown, parse: ValueParser<T>): StoredValue<T> {
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

export function ready<T>(value: T): StoredValue<T> {
  return { status: 'ready', value }
}

export function storedJsonColumn<T>(parse: ValueParser<T>) {
  return customType<{ data: StoredValue<T>; driverData: string; jsonData: unknown }>({
    dataType: () => 'text',
    toDriver(value) {
      if (value.status !== 'ready') {
        throw new DesktopError('InvalidInput', 'Cannot save an invalid stored value')
      }
      return JSON.stringify(parse(value.value))
    },
    fromDriver: (source) => readStoredValue(source, parse),
    fromJson: (source) => readStoredValue(source, parse),
  })
}
