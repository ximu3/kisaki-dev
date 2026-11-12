/** @fileoverview Defines civil date values, precision, canonical era conversion and valid query bounds. */

import { DesktopError } from './errors'
import type { Bounds } from './operations'

/** A civil day, independent of a time zone; astronomical year zero is 1 BCE. */
export interface CalendarDate {
  readonly year: number
  readonly month: number
  readonly day: number
}

/**
 * A civil date with at least one known component.
 *
 * A supplied value replaces the entire date rather than merging components.
 */
export type PartialDate =
  | { readonly year: number; readonly month?: number; readonly day?: number }
  | { readonly year?: number; readonly month: number; readonly day?: number }
  | { readonly year?: number; readonly month?: number; readonly day: number }

/** An absolute query boundary has continuous precision: year, year/month, or a full day. */
export type YearDate =
  | { readonly year: number; readonly month?: never; readonly day?: never }
  | { readonly year: number; readonly month: number; readonly day?: number }

/** A birthday boundary omits the year and has month or month/day precision. */
export interface MonthDate {
  readonly month: number
  readonly day?: number
}

/** Inclusive comparison bounds, expanded for querying only; stored values retain their precision. */
export interface CalendarDateRange {
  readonly from: CalendarDate
  readonly to: CalendarDate
}

/**
 * An era and positive decimal year for lossless display and input.
 *
 * The year uses text because the minimum internal year maps to 9007199254740992 BCE.
 */
export interface EraYear {
  readonly era: 'ce' | 'bce'
  readonly year: string
}

const minYear = BigInt(Number.MIN_SAFE_INTEGER)

const maxYear = BigInt(Number.MAX_SAFE_INTEGER)

/** Rejects an invalid Gregorian date with the shared InvalidInput classification. */
function invalidDate(): never {
  throw new DesktopError('InvalidInput', 'Invalid Gregorian date')
}

/** Checks the safe-integer year range and normalizes negative zero. */
function requireYear(year: number): number {
  if (!Number.isSafeInteger(year)) {
    invalidDate()
  }
  return year === 0 ? 0 : year
}

/**
 * Tests a safe astronomical year against the proleptic Gregorian leap-year cycle, including BCE.
 */
export function isLeapYear(year: number): boolean {
  requireYear(year)
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

/** Returns a valid month's length, allowing February 29 when the year is unknown. */
export function daysInMonth(month: number, year?: number): number {
  if (!Number.isSafeInteger(month) || month < 1 || month > 12) {
    invalidDate()
  }
  if (year !== undefined) {
    requireYear(year)
  }

  if (month === 2) {
    return year === undefined || isLeapYear(year) ? 29 : 28
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/**
 * Parses the seven nonempty date-component combinations.
 *
 * Rejects null, unknown keys, overflows and impossible calendar values; present components are
 * preserved.
 */
export function parsePartialDate(input: unknown): PartialDate {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    invalidDate()
  }

  const value = input as Record<string, unknown>
  const keys = Object.keys(value)
  if (keys.length === 0 || keys.some((key) => !['year', 'month', 'day'].includes(key))) {
    invalidDate()
  }
  for (const key of keys) {
    if (typeof value[key] !== 'number' || !Number.isSafeInteger(value[key])) {
      invalidDate()
    }
  }

  const year = value.year as number | undefined
  const month = value.month as number | undefined
  const day = value.day as number | undefined
  if (month !== undefined && (month < 1 || month > 12)) {
    invalidDate()
  }
  if (
    day !== undefined &&
    (day < 1 || day > (month === undefined ? 31 : daysInMonth(month, year)))
  ) {
    invalidDate()
  }

  // Every present component was validated, and the object has at least one component.
  return {
    ...(year === undefined ? {} : { year: year === 0 ? 0 : year }),
    ...(month === undefined ? {} : { month }),
    ...(day === undefined ? {} : { day }),
  } as PartialDate
}

/**
 * Parses all three components of a real day.
 *
 * Date absence is represented by the owning nullable field.
 */
export function parseCalendarDate(input: unknown): CalendarDate {
  const value = parsePartialDate(input)
  if (value.year === undefined || value.month === undefined || value.day === undefined) {
    invalidDate()
  }
  return { year: value.year, month: value.month, day: value.day }
}

/** Parses an absolute boundary with year, year/month or full-day precision. */
export function parseYearDate(input: unknown): YearDate {
  const value = parsePartialDate(input)
  if (value.year === undefined || (value.month === undefined && value.day !== undefined)) {
    invalidDate()
  }

  if (value.month === undefined) {
    return { year: value.year }
  }

  return {
    year: value.year,
    month: value.month,
    ...(value.day === undefined ? {} : { day: value.day }),
  }
}

/** Parses a yearless month or month/day boundary, including February 29. */
export function parseMonthDate(input: unknown): MonthDate {
  const value = parsePartialDate(input)
  if (value.year !== undefined || value.month === undefined) {
    invalidDate()
  }
  return { month: value.month, ...(value.day === undefined ? {} : { day: value.day }) }
}

/**
 * Converts positive decimal era-year text into an exact safe astronomical year.
 *
 * Trims surrounding whitespace and rejects invalid text or values outside the safe-integer range.
 */
export function parseEraYear(input: string, era: 'ce' | 'bce'): number {
  const text = input.trim()
  if (!/^[0-9]+$/.test(text) || (era !== 'ce' && era !== 'bce')) {
    invalidDate()
  }
  const eraYear = BigInt(text)
  if (eraYear < 1n) {
    invalidDate()
  }

  const year = era === 'bce' ? 1n - eraYear : eraYear
  if (year < minYear || year > maxYear) {
    invalidDate()
  }

  return Number(year)
}

/** Converts a safe astronomical year into an era and exact positive decimal year text. */
export function toEraYear(year: number): EraYear {
  requireYear(year)
  return year > 0
    ? { era: 'ce', year: String(year) }
    : { era: 'bce', year: String(1n - BigInt(year)) }
}

/** Compares valid complete days lexicographically, returning -1, 0 or 1. */
export function compareCalendarDates(left: CalendarDate, right: CalendarDate): number {
  for (const component of ['year', 'month', 'day'] as const) {
    if (left[component] !== right[component]) {
      return left[component] < right[component] ? -1 : 1
    }
  }

  return 0
}

/** Expands an absolute query boundary into its first and last possible day. */
export function expandYearDate(input: YearDate): CalendarDateRange {
  const value = parseYearDate(input)
  const firstMonth = value.month ?? 1
  const lastMonth = value.month ?? 12

  return {
    from: { year: value.year, month: firstMonth, day: value.day ?? 1 },
    to: {
      year: value.year,
      month: lastMonth,
      day: value.day ?? daysInMonth(lastMonth, value.year),
    },
  }
}

/** Parses inclusive absolute query bounds and rejects reversed ranges. */
export function parseDateBounds(input: unknown): Bounds<YearDate> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    invalidDate()
  }

  const source = input as Record<string, unknown>
  const keys = Object.keys(source)
  if (keys.length === 0 || keys.some((key) => key !== 'min' && key !== 'max')) {
    invalidDate()
  }

  const min = Object.hasOwn(source, 'min') ? parseYearDate(source.min) : undefined
  const max = Object.hasOwn(source, 'max') ? parseYearDate(source.max) : undefined
  if (min && max && compareCalendarDates(expandYearDate(min).from, expandYearDate(max).to) > 0) {
    invalidDate()
  }

  return min ? { min, ...(max ? { max } : {}) } : { max: max! }
}
