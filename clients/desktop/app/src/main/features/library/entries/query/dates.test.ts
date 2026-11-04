/** @fileoverview Verifies dates behavior using isolated synthetic inputs. */

import { comparePartialDates, matchesAbsoluteDateRange, matchesMonthDayRange } from './dates'

import { test, expect } from 'vitest'

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
