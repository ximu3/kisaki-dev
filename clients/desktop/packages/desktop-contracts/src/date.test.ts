/** @fileoverview Verifies date behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { parsePartialDate, isLeapYear, parseCalendarDate, toEraYear, parseEraYear } from './date'

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
