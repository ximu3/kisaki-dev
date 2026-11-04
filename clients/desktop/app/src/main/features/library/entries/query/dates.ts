/** @fileoverview Evaluates query date ranges and stable partial-date ordering without timestamps. */

import type { PartialDate, YearDate, MonthDate } from '@kisaki3/desktop-contracts/date'
import type { Bounds } from '@kisaki3/desktop-contracts/operations'
import {
  parseDateBounds,
  parsePartialDate,
  daysInMonth,
  compareCalendarDates,
  expandYearDate,
  parseMonthDate,
} from '@kisaki3/desktop-contracts/date'

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
