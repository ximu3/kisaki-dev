import type { CalendarDate } from '@kisaki3/desktop-contracts/date'
export type Period = 'all' | 'week' | 'month' | 'year'
export function dayValue(d: Date): CalendarDate {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
}
export function fromDay(day: CalendarDate) {
  const d = new Date(0)
  d.setFullYear(day.year, day.month - 1, day.day)
  d.setHours(0, 0, 0, 0)
  return d
}
export function shift(date: Date, period: Period, delta: number) {
  const d = new Date(date)
  if (period === 'week') {
    d.setDate(d.getDate() + delta * 7)
  }
  if (period === 'month') {
    d.setDate(1)
    d.setMonth(d.getMonth() + delta)
  }
  if (period === 'year') {
    d.setDate(1)
    d.setFullYear(d.getFullYear() + delta)
  }
  return d
}
export function periodRange(value: Date, period: Period) {
  if (period === 'all') {
    return undefined
  }
  const start = new Date(value)
  start.setHours(0, 0, 0, 0)
  if (period === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  }
  if (period === 'month') {
    start.setDate(1)
  }
  if (period === 'year') {
    start.setMonth(0, 1)
  }
  return { from: start.getTime(), to: shift(start, period, 1).getTime() }
}
export function daySpan(from: Date) {
  const next = new Date(from)
  next.setDate(next.getDate() + 1)
  return { from: from.getTime(), to: next.getTime() }
}
