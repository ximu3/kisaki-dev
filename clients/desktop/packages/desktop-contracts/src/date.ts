/** @fileoverview Owns proleptic Gregorian calendar values, astronomical years, and pure comparisons. */

import * as v from 'valibot'
import { objectSchema } from './schema'
import { invalidInput } from './errors'
import { parseContract, safeIntegerSchema } from './validation'

const yearSchema = v.pipe(
  safeIntegerSchema,
  v.transform((value) => (value === 0 ? 0 : value)),
)
const monthSchema = v.pipe(safeIntegerSchema, v.minValue(1), v.maxValue(12))
const daySchema = v.pipe(safeIntegerSchema, v.minValue(1), v.maxValue(31))
const optionalYear = v.exactOptional(yearSchema)
const optionalMonth = v.exactOptional(monthSchema)
const optionalDay = v.exactOptional(daySchema)

/** A known Gregorian year, month, and day; it has no timezone or time of day. */
export interface CalendarDate {
  readonly year: number
  readonly month: number
  readonly day: number
}

/** At least one known date component; unknown components are absent, never null or zero placeholders. */
export type PartialDate =
  | { readonly year: number; readonly month?: number; readonly day?: number }
  | { readonly year?: number; readonly month: number; readonly day?: number }
  | { readonly year?: number; readonly month?: number; readonly day: number }

/** A continuous year-based precision, suitable for an absolute date-range endpoint. */
export type YearDate =
  | { readonly year: number; readonly month?: never; readonly day?: never }
  | { readonly year: number; readonly month: number; readonly day?: number }

/** A month or month/day endpoint, independent of a year; ranges may wrap across New Year. */
export interface MonthDate {
  readonly month: number
  readonly day?: number
}

/** An inclusive range with at least one endpoint. Each consumer validates its own value domain. */
export type Bounds<Value> =
  { readonly min: Value; readonly max?: Value } | { readonly min?: Value; readonly max: Value }

export const partialDateSchema = v.pipe(
  v.union([
    objectSchema({ year: yearSchema, month: optionalMonth, day: optionalDay }),
    objectSchema({ year: optionalYear, month: monthSchema, day: optionalDay }),
    objectSchema({ year: optionalYear, month: optionalMonth, day: daySchema }),
  ]),
  v.check((date) => isCalendarCombination(date)),
)

export const calendarDateSchema = v.pipe(
  objectSchema({ year: yearSchema, month: monthSchema, day: daySchema }),
  v.check((date) => isCalendarCombination(date)),
)
export const yearDateSchema = v.pipe(
  v.union([
    objectSchema({ year: yearSchema }),
    objectSchema({ year: yearSchema, month: monthSchema, day: optionalDay }),
  ]),
  v.check((date) => isCalendarCombination(date)),
)
export const monthDateSchema = v.pipe(
  objectSchema({ month: monthSchema, day: optionalDay }),
  v.check((date) => isCalendarCombination(date)),
)

/** Strictly parse one whole date; never fill, roll over, or delete invalid components. */
export function parsePartialDate(input: unknown): PartialDate {
  return parseContract(partialDateSchema, input, 'partial date')
}

/** Strictly parse a complete calendar fact, retaining the full safe-integer year range. */
export function parseCalendarDate(input: unknown): CalendarDate {
  return parseContract(calendarDateSchema, input, 'calendar date')
}

/** Parse an absolute range endpoint; year plus day without month cannot define a boundary. */
export function parseYearDate(input: unknown): YearDate {
  return parseContract(yearDateSchema, input, 'year date')
}

/** Parse a year-independent month/day endpoint, including February 29. */
export function parseMonthDate(input: unknown): MonthDate {
  return parseContract(monthDateSchema, input, 'month date')
}

/** Read a decoded nullable stored value tolerantly, without writing a repair back to storage. */
export function readPartialDate(input: unknown): PartialDate | null {
  const result = v.safeParse(partialDateSchema, input)
  return result.success ? result.output : null
}

/** Read a decoded complete-date value; malformed dates do not erase the containing record. */
export function readCalendarDate(input: unknown): CalendarDate | null {
  const result = v.safeParse(calendarDateSchema, input)
  return result.success ? result.output : null
}

/** Gregorian leap-year calculation for an already validated astronomical year, including zero. */
export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

/** Return a month length for validated components; an unknown year permits February 29. */
export function daysInMonth(month: number, year?: number): number {
  if (month === 2) {
    return year === undefined || isLeapYear(year) ? 29 : 28
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31
}

/** Convert an exact, positive era-year text without first rounding through a JavaScript number. */
export function parseEraYear(era: 'ce' | 'bce', input: string): number {
  if (!/^[0-9]+$/.test(input) || BigInt(input) < 1n || (era !== 'ce' && era !== 'bce')) {
    return invalidInput('Invalid era year.')
  }
  const year = era === 'bce' ? 1n - BigInt(input) : BigInt(input)
  if (year < BigInt(Number.MIN_SAFE_INTEGER) || year > BigInt(Number.MAX_SAFE_INTEGER)) {
    return invalidInput('The year is outside the supported range.')
  }
  return Number(year)
}

/** Format a validated astronomical year as an exact positive era-year string. */
export function formatEraYear(year: number): { readonly era: 'ce' | 'bce'; readonly year: string } {
  parseContract(yearSchema, year, 'year')
  return year > 0
    ? { era: 'ce', year: String(year) }
    : { era: 'bce', year: String(1n - BigInt(year)) }
}

/** Compare complete calendar facts without timestamps, overflow, or timezone conversion. */
export function compareCalendarDates(left: CalendarDate, right: CalendarDate): number {
  return (
    compare(left.year, right.year) ||
    compare(left.month, right.month) ||
    compare(left.day, right.day)
  )
}

/** Sort by known components; unknown components and null remain last in either direction. */
export function comparePartialDates(
  left: PartialDate | null,
  right: PartialDate | null,
  direction: 'asc' | 'desc' = 'asc',
): number {
  if (left === null || right === null) {
    if (left === right) {
      return 0
    }
    return left === null ? 1 : -1
  }
  for (const component of ['year', 'month', 'day'] as const) {
    const a = left[component]
    const b = right[component]
    if (a === undefined || b === undefined) {
      if (a !== b) {
        return a === undefined ? 1 : -1
      }
    } else if (a !== b) {
      return compare(a, b) * (direction === 'asc' ? 1 : -1)
    }
  }
  return 0
}

/** Match only when every possible date of a year-bearing value lies within the inclusive range. */
export function matchesAbsoluteDateRange(
  date: PartialDate | null,
  bounds: Bounds<YearDate>,
): boolean {
  const min = bounds.min === undefined ? undefined : dateExtent(parseYearDate(bounds.min)).min
  const max = bounds.max === undefined ? undefined : dateExtent(parseYearDate(bounds.max)).max
  if ((!min && !max) || (min && max && compareCalendarDates(min, max) > 0)) {
    return invalidInput('Invalid absolute date range.')
  }
  if (date === null || date.year === undefined) {
    return false
  }
  const extent = dateExtent({ ...date, year: date.year })
  return (
    (!min || compareCalendarDates(extent.min, min) >= 0) &&
    (!max || compareCalendarDates(extent.max, max) <= 0)
  )
}

/** Match a cyclic month/day range only when all dates allowed by the known components fit. */
export function matchesMonthDayRange(
  date: PartialDate | null,
  from: MonthDate,
  to: MonthDate,
): boolean {
  const start = parseMonthDate(from)
  const end = parseMonthDate(to)
  const lower = start.month * 32 + (start.day ?? 1)
  const upper = end.month * 32 + (end.day ?? daysInMonth(end.month))
  if (date === null) {
    return false
  }
  for (let month = 1; month <= 12; month++) {
    if (date.month !== undefined && month !== date.month) {
      continue
    }
    for (let day = 1; day <= daysInMonth(month, date.year); day++) {
      if (date.day !== undefined && day !== date.day) {
        continue
      }
      const value = month * 32 + day
      const inside =
        lower <= upper ? value >= lower && value <= upper : value >= lower || value <= upper
      if (!inside) {
        return false
      }
    }
  }
  return true
}

function isCalendarCombination(date: {
  readonly year?: number
  readonly month?: number
  readonly day?: number
}): boolean {
  return (
    date.month === undefined ||
    date.day === undefined ||
    date.day <= daysInMonth(date.month, date.year)
  )
}

function dateExtent(date: PartialDate & { readonly year: number }): {
  min: CalendarDate
  max: CalendarDate
} {
  const firstMonth = date.month ?? 1
  const lastMonth = date.month ?? 12
  return {
    min: { year: date.year, month: firstMonth, day: date.day ?? 1 },
    max: { year: date.year, month: lastMonth, day: date.day ?? daysInMonth(lastMonth, date.year) },
  }
}

function compare(left: number, right: number): number {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}
