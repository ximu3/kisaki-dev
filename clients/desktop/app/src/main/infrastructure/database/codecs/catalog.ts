/** @fileoverview Encodes catalog dates, descriptive lists and measurements with their field-specific read policies. */

import { parseEntryCreate, parseLanguageTag } from '@kisaki3/desktop-contracts/library'
import type { ExternalLink, CharacterMeasure } from '@kisaki3/desktop-contracts/library'
import { parsePartialDate, parseCalendarDate } from '@kisaki3/desktop-contracts/date'
import type { PartialDate, CalendarDate } from '@kisaki3/desktop-contracts/date'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { jsonColumn, readWithFallback, readJsonText, isInvalidValue } from './json'
import type { ValueParser } from './json'

/** Validates aliases through the shared catalog input contract. */
function parseAliases(input: unknown): readonly string[] {
  return parseEntryCreate({ type: 'game', name: 'codec', aliases: input }).aliases ?? []
}

/** Validates links through the shared catalog input contract. */
function parseLinks(input: unknown): readonly ExternalLink[] {
  return parseEntryCreate({ type: 'game', name: 'codec', externalLinks: input }).externalLinks ?? []
}

/** Validates one measurement without interpreting wording as a number. */
function parseMeasure(input: unknown): CharacterMeasure | null {
  const value = parseEntryCreate({ type: 'character', name: 'codec', age: input })
  return value.type === 'character' ? (value.age ?? null) : null
}

/** Reads valid list members in their original order without writing the projection back. */
function readList<T>(source: unknown, parse: ValueParser<readonly T[]>): readonly T[] {
  let value: unknown
  try {
    value = readJsonText(source)
  } catch (error) {
    if (!isInvalidValue(error)) {
      throw error
    }
    return []
  }
  if (!Array.isArray(value)) {
    return []
  }

  const result: T[] = []
  for (const item of value) {
    try {
      result.push(...parse([item]))
    } catch (error) {
      if (!isInvalidValue(error)) {
        throw error
      }
    }
  }
  return result
}

/** Validates a distinct, ordered language list. */
function parseLanguages(input: unknown): readonly string[] {
  if (!Array.isArray(input)) {
    throw new DesktopError('InvalidInput', 'Expected a language list')
  }
  const values = input.map(parseLanguageTag)
  if (new Set(values).size !== values.length) {
    throw new DesktopError('InvalidInput', 'Expected distinct languages')
  }
  return values
}

/**
 * Builds alias columns with strict writes and read-side retention of valid items in their saved
 * order.
 */
export const aliases = jsonColumn(parseAliases, (source) => readList(source, parseAliases))

/** Builds descriptive-link columns that retain valid stored links without changing their order. */
export const externalLinks = jsonColumn(parseLinks, (source) => readList(source, parseLinks))

/** Builds canonical language-list columns with distinct writes and tolerant, ordered reads. */
export const languages = jsonColumn(parseLanguages, (source) => [
  ...new Set(readList(source, parseLanguages)),
])

/** Builds nullable partial-date columns whose invalid stored values read as null without repair. */
export const partialDate = jsonColumn<PartialDate | null>(
  (value) => (value === null ? null : parsePartialDate(value)),
  (source) => readWithFallback(source, parsePartialDate, () => null),
)

/**
 * Builds complete civil-date columns that preserve date components and read invalid stored dates
 * as null.
 */
export const calendarDate = jsonColumn<CalendarDate | null>(
  (value) => (value === null ? null : parseCalendarDate(value)),
  (source) => readWithFallback(source, parseCalendarDate, () => null),
)

/**
 * Builds character-measure columns that preserve numeric facts or source wording and isolate
 * invalid values.
 */
export const characterMeasure = jsonColumn(parseMeasure, (source) =>
  readWithFallback(source, parseMeasure, () => null),
)
