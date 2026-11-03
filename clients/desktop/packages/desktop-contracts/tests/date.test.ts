/** @fileoverview Exercises civil-date precision, BCE arithmetic and range boundaries independently of timestamps. */

import { describe, expect, test } from 'vitest'
import {
  comparePartialDates,
  isLeapYear,
  matchesAbsoluteDateRange,
  matchesMonthDayRange,
  parseCalendarDate,
  parseEraYear,
  parsePartialDate,
  toEraYear,
} from '../src/date'

describe('civil date values', () => {
  test('preserves each of the seven component combinations including astronomical year zero', () => {
    for (const value of [
      { year: 0 },
      { month: 2 },
      { day: 29 },
      { year: 0, month: 2 },
      { year: 0, day: 29 },
      { month: 2, day: 29 },
      { year: 0, month: 2, day: 29 },
    ]) {
      expect(parsePartialDate(value)).toEqual(value)
    }
    expect(parsePartialDate({ year: -0 })).toEqual({ year: 0 })
    expect(isLeapYear(-400)).toBe(true)
    expect(isLeapYear(-100)).toBe(false)
  })

  test('rejects empty, overflowing and impossible facts without deleting bad components', () => {
    for (const value of [
      {},
      { year: null },
      { month: 0 },
      { day: 32 },
      { month: 2, day: 30 },
      { year: 1900, month: 2, day: 29 },
      { year: Number.MAX_SAFE_INTEGER + 1 },
      { year: undefined },
      { year: 2024, precision: 'year' },
    ]) {
      expect(() => parsePartialDate(value)).toThrow()
    }
    expect(() => parseCalendarDate({ year: 2024, month: 2 })).toThrow()
    expect(parseCalendarDate({ year: 2024, month: 2, day: 29 })).toEqual({
      year: 2024,
      month: 2,
      day: 29,
    })
  })

  test('round trips both safe-integer extremes through exact era text', () => {
    for (const year of [Number.MIN_SAFE_INTEGER, -400, -1, 0, 1, 12_000, Number.MAX_SAFE_INTEGER]) {
      const display = toEraYear(year)
      expect(parseEraYear(display.year, display.era)).toBe(year)
    }
    expect(toEraYear(Number.MIN_SAFE_INTEGER)).toEqual({ era: 'bce', year: '9007199254740992' })
    expect(() => parseEraYear('9007199254740993', 'bce')).toThrow()
    expect(() => parseEraYear('9007199254740992', 'ce')).toThrow()
  })

  test('requires enough precision for the entire possible date to fit the queried period', () => {
    const year = { min: { year: 2024 }, max: { year: 2024 } }
    const day = { min: { year: 2024, month: 5, day: 3 }, max: { year: 2024, month: 5, day: 3 } }
    expect(matchesAbsoluteDateRange({ year: 2024 }, year)).toBe(true)
    expect(matchesAbsoluteDateRange({ month: 5, day: 3 }, year)).toBe(false)
    expect(matchesAbsoluteDateRange({ year: 2024, month: 5 }, day)).toBe(false)
    expect(matchesAbsoluteDateRange({ year: 2024, month: 5, day: 3 }, day)).toBe(true)
    expect(
      matchesAbsoluteDateRange(
        { year: 2024, day: 31 },
        { min: { year: 2024, month: 1, day: 31 }, max: { year: 2024, month: 12, day: 31 } },
      ),
    ).toBe(true)
    expect(
      matchesMonthDayRange({ month: 1, day: 3 }, { month: 12, day: 20 }, { month: 1, day: 10 }),
    ).toBe(true)
    expect(matchesMonthDayRange({ month: 1 }, { month: 12, day: 20 }, { month: 1, day: 10 })).toBe(
      false,
    )
  })

  test('keeps unknown components and whole unknown dates last for either direction', () => {
    for (const direction of ['asc', 'desc'] as const) {
      expect(comparePartialDates({ year: 2024, month: 5 }, { year: 2024 }, direction)).toBe(-1)
      expect(comparePartialDates({ month: 5 }, null, direction)).toBe(-1)
      expect(comparePartialDates({ year: 0 }, { month: 1 }, direction)).toBe(-1)
    }
  })
})
