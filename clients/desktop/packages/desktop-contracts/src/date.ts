/** @fileoverview Validates and compares proleptic Gregorian facts without inventing unknown components. */

import { DesktopError } from './errors'
import type { Bounds } from './operations'

/** A civil day, independent of a time zone; astronomical year zero is 1 BCE. */
export interface CalendarDate {
  readonly year: number
  readonly month: number
  readonly day: number
}

/** At least one known component. A supplied value replaces the entire date, never merges components. */
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

/** The display year is decimal text because the minimum internal year requires 9007199254740992 BCE. */
export interface EraYear {
  readonly era: 'ce' | 'bce'
  readonly year: string
}

const minYear = BigInt(Number.MIN_SAFE_INTEGER)
const maxYear = BigInt(Number.MAX_SAFE_INTEGER)

function invalidDate(): never {
  throw new DesktopError('InvalidInput', 'Invalid Gregorian date')
}

function requireYear(year: number): number {
  if (!Number.isSafeInteger(year)) {
    invalidDate()
  }
  return year === 0 ? 0 : year
}

/** Test a safe astronomical year using the proleptic Gregorian 400-year cycle, including BCE. */
export function isLeapYear(year: number): boolean {
  requireYear(year)
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

/** Return a month's real length; without a year, February may contain 29 days. */
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

/** Parse all seven nonempty component combinations; reject null, unknown keys, overflows and rollovers. */
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

/** Require all three components of a real day; absence belongs to an owning nullable field. */
export function parseCalendarDate(input: unknown): CalendarDate {
  const value = parsePartialDate(input)
  if (value.year === undefined || value.month === undefined || value.day === undefined) {
    invalidDate()
  }
  return { year: value.year, month: value.month, day: value.day }
}

/** Parse a continuous-precision absolute boundary; year/day without month is not a boundary. */
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

/** Parse a yearless month or month/day boundary, including February 29. */
export function parseMonthDate(input: unknown): MonthDate {
  const value = parsePartialDate(input)
  if (value.year !== undefined || value.month === undefined) {
    invalidDate()
  }
  return { month: value.month, ...(value.day === undefined ? {} : { day: value.day }) }
}

/** Convert a positive decimal era year precisely before checking the internal safe-integer range. */
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

/** Return an exact era and positive decimal year for display or input, without floating-point rounding. */
export function toEraYear(year: number): EraYear {
  requireYear(year)
  return year > 0
    ? { era: 'ce', year: String(year) }
    : { era: 'bce', year: String(1n - BigInt(year)) }
}

/** Compare complete valid days lexicographically; no time zone or timestamp conversion is involved. */
export function compareCalendarDates(left: CalendarDate, right: CalendarDate): number {
  for (const component of ['year', 'month', 'day'] as const) {
    if (left[component] !== right[component]) {
      return left[component] < right[component] ? -1 : 1
    }
  }

  return 0
}

/**
 * Sort known components before unknown components in either direction; null is always last.
 * This is a stable display order, not proof of temporal precedence between partial facts.
 */
export function comparePartialDates(
  left: PartialDate | null,
  right: PartialDate | null,
  direction: 'asc' | 'desc' = 'asc',
): number {
  return compareDateComponents(left, right, ['year', 'month', 'day'], direction)
}

/** Sort birthdays independently of the year, with unknown components and whole null values last. */
export function compareMonthDays(
  left: PartialDate | null,
  right: PartialDate | null,
  direction: 'asc' | 'desc' = 'asc',
): number {
  return compareDateComponents(left, right, ['month', 'day'], direction)
}

function compareDateComponents(
  left: PartialDate | null,
  right: PartialDate | null,
  components: readonly ('year' | 'month' | 'day')[],
  direction: 'asc' | 'desc',
): number {
  if (left === null || right === null) {
    if (left === right) {
      return 0
    }

    return left === null ? 1 : -1
  }

  for (const component of components) {
    const a = left[component]
    const b = right[component]
    if (a === b) {
      continue
    }
    if (a === undefined || b === undefined) {
      return a === undefined ? 1 : -1
    }

    return (a < b ? -1 : 1) * (direction === 'asc' ? 1 : -1)
  }

  return 0
}

/** Expand an absolute query boundary into its first and last possible day, without changing the input. */
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

/** Validate inclusive absolute query bounds; reversed ranges are rejected instead of swapped. */
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

/** Match only when every possible day of a year-bearing fact lies inside the inclusive bounds. */
export function matchesAbsoluteDateRange(
  value: PartialDate | null,
  bounds: Bounds<YearDate>,
): boolean {
  const range = parseDateBounds(bounds)
  if (value === null || value.year === undefined) {
    return false
  }

  const date = parsePartialDate(value)
  const from = { year: value.year, month: date.month ?? 1, day: date.day ?? 1 }
  const to = {
    year: value.year,
    month: date.month ?? 12,
    day: date.day ?? daysInMonth(date.month ?? 12, value.year),
  }

  return (
    (!range.min || compareCalendarDates(from, expandYearDate(range.min).from) >= 0) &&
    (!range.max || compareCalendarDates(to, expandYearDate(range.max).to) <= 0)
  )
}

/** Match a known month/day fact against a possibly year-wrapping birthday range; never invent its year. */
export function matchesMonthDayRange(
  value: PartialDate | null,
  from: MonthDate,
  to: MonthDate,
): boolean {
  const start = parseMonthDate(from)
  const end = parseMonthDate(to)
  if (value === null || value.month === undefined) {
    return false
  }

  const date = parsePartialDate(value)
  const first = value.month * 32 + (date.day ?? 1)
  const last = value.month * 32 + (date.day ?? daysInMonth(value.month, date.year))
  const minimum = start.month * 32 + (start.day ?? 1)
  const maximum = end.month * 32 + (end.day ?? daysInMonth(end.month))

  return minimum <= maximum
    ? first >= minimum && last <= maximum
    : first >= minimum || last <= maximum
}
