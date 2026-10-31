/** @fileoverview Verifies lossless Gregorian dates, tolerant storage reads, and precision-aware ranges. */

import { describe, expect, it } from 'vitest'
import {
  comparePartialDates,
  daysInMonth,
  formatEraYear,
  isLeapYear,
  matchesAbsoluteDateRange,
  matchesMonthDayRange,
  parseCalendarDate,
  parseEraYear,
  parsePartialDate,
  readCalendarDate,
  readPartialDate,
} from './date'

describe('calendar values', () => {
  it.each([
    { year: 0 },
    { month: 2 },
    { day: 31 },
    { year: -1, month: 3 },
    { year: 2024, day: 31 },
    { month: 2, day: 29 },
    { year: 0, month: 2, day: 29 },
  ])('preserves each legal component combination: %j', (value) => {
    expect(parsePartialDate(value)).toEqual(value)
  })

  it.each([
    {},
    { year: null },
    { year: undefined },
    { month: 0 },
    { day: 0 },
    { month: 2, day: 30 },
    { year: 1900, month: 2, day: 29 },
    { year: 1.5 },
    { year: NaN },
    { year: Infinity },
    { year: Number.MAX_SAFE_INTEGER + 1 },
    { year: 1, precision: 'year' },
  ])('rejects the whole malformed date: %j', (value) => {
    expect(() => parsePartialDate(value)).toThrow(expect.objectContaining({ code: 'InvalidInput' }))
    expect(readPartialDate(value)).toBeNull()
  })

  it('normalizes negative zero, preserves extreme years, and requires every calendar component', () => {
    expect(Object.is(parsePartialDate({ year: -0 }).year, 0)).toBe(true)
    for (const year of [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 12000]) {
      expect(parseCalendarDate({ year, month: 12, day: 31 })).toEqual({ year, month: 12, day: 31 })
    }
    expect(readCalendarDate({ year: 2024, month: 2 })).toBeNull()
    expect(readCalendarDate(null)).toBeNull()
  })

  it('uses the Gregorian 400-year cycle across both sides of the era boundary', () => {
    const examples = [
      [-400, true],
      [-100, false],
      [-1, false],
      [0, true],
      [4, true],
      [1900, false],
      [2000, true],
      [2004, true],
    ] as const
    for (const [year, leap] of examples) {
      expect(isLeapYear(year)).toBe(leap)
      expect(daysInMonth(2, year)).toBe(leap ? 29 : 28)
    }
  })

  it('round-trips era inputs beyond the safe positive era-year limit without rounding', () => {
    expect(parseEraYear('bce', '9007199254740992')).toBe(Number.MIN_SAFE_INTEGER)
    expect(parseEraYear('bce', '1')).toBe(0)
    for (const year of [Number.MIN_SAFE_INTEGER, -400, -1, 0, 1, 12000, Number.MAX_SAFE_INTEGER]) {
      const formatted = formatEraYear(year)
      expect(parseEraYear(formatted.era, formatted.year)).toBe(year)
    }
    for (const input of ['0', '-1', '1.5', '1e3', '', '9007199254740993']) {
      expect(() => parseEraYear('bce', input)).toThrow()
    }
    expect(() => parseEraYear('ce', '9007199254740992')).toThrow()
  })
})

describe('date comparisons', () => {
  it('does not treat a broad or unknown date as an invented precise day', () => {
    const may = { min: { year: 2024, month: 5 }, max: { year: 2024, month: 5 } }
    expect(matchesAbsoluteDateRange({ year: 2024, month: 5 }, may)).toBe(true)
    expect(matchesAbsoluteDateRange({ year: 2024 }, may)).toBe(false)
    expect(matchesAbsoluteDateRange({ month: 5, day: 3 }, may)).toBe(false)
    expect(
      matchesAbsoluteDateRange(
        { year: 2024, day: 3 },
        { min: { year: 2024 }, max: { year: 2024 } },
      ),
    ).toBe(true)
    expect(() =>
      matchesAbsoluteDateRange({ year: 0 }, { min: { year: 1 }, max: { year: -1 } }),
    ).toThrow()
  })

  it('matches month/day ranges across New Year without losing unknown-day precision', () => {
    expect(
      matchesMonthDayRange({ month: 12, day: 25 }, { month: 12, day: 20 }, { month: 1, day: 10 }),
    ).toBe(true)
    expect(matchesMonthDayRange({ month: 5 }, { month: 5 }, { month: 5 })).toBe(true)
    expect(matchesMonthDayRange({ month: 5 }, { month: 5, day: 3 }, { month: 5, day: 10 })).toBe(
      false,
    )
    expect(matchesMonthDayRange({ month: 2, day: 29 }, { month: 2 }, { month: 2 })).toBe(true)
  })

  it('keeps unknown components last for both sort directions', () => {
    for (const direction of ['asc', 'desc'] as const) {
      expect(
        comparePartialDates({ year: 2024, month: 5, day: 3 }, { year: 2024, month: 5 }, direction),
      ).toBeLessThan(0)
      expect(comparePartialDates({ year: 2024 }, { month: 5 }, direction)).toBeLessThan(0)
      expect(comparePartialDates({ month: 5 }, null, direction)).toBeLessThan(0)
    }
    expect(comparePartialDates({ year: -1 }, { year: 0 })).toBeLessThan(0)
  })
})
