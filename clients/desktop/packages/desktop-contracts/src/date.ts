import { DesktopError } from './errors'
import type { Bounds } from './operations'

export interface CalendarDate {
  readonly year: number
  readonly month: number
  readonly day: number
}

export type PartialDate =
  | { readonly year: number; readonly month?: number; readonly day?: number }
  | { readonly year?: number; readonly month: number; readonly day?: number }
  | { readonly year?: number; readonly month?: number; readonly day: number }

export type YearDate =
  | { readonly year: number; readonly month?: never; readonly day?: never }
  | { readonly year: number; readonly month: number; readonly day?: number }

export interface MonthDate {
  readonly month: number
  readonly day?: number
}

export interface CalendarDateRange {
  readonly from: CalendarDate
  readonly to: CalendarDate
}

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

export function isLeapYear(year: number): boolean {
  requireYear(year)
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

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

export function parseCalendarDate(input: unknown): CalendarDate {
  const value = parsePartialDate(input)
  if (value.year === undefined || value.month === undefined || value.day === undefined) {
    invalidDate()
  }
  return { year: value.year, month: value.month, day: value.day }
}

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

export function parseMonthDate(input: unknown): MonthDate {
  const value = parsePartialDate(input)
  if (value.year !== undefined || value.month === undefined) {
    invalidDate()
  }
  return { month: value.month, ...(value.day === undefined ? {} : { day: value.day }) }
}

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

export function toEraYear(year: number): EraYear {
  requireYear(year)
  return year > 0
    ? { era: 'ce', year: String(year) }
    : { era: 'bce', year: String(1n - BigInt(year)) }
}

export function compareCalendarDates(left: CalendarDate, right: CalendarDate): number {
  for (const component of ['year', 'month', 'day'] as const) {
    if (left[component] !== right[component]) {
      return left[component] < right[component] ? -1 : 1
    }
  }

  return 0
}

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
