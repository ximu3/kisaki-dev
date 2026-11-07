/** @fileoverview Complete ISO calendar dates use UTC arithmetic independent of daylight saving. */

const dayMs = 86_400_000

export function parseDate(value: string): Date | undefined {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith('0000')) {
    return
  }
  const date = new Date(`${value}T00:00:00Z`)

  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : undefined
}

export function dateValue(date: Date): string {
  if (date.getUTCFullYear() < 1) {
    return '0001-01-01'
  }
  if (date.getUTCFullYear() > 9999) {
    return '9999-12-31'
  }
  return date.toISOString().slice(0, 10)
}

export function todayValue(): string {
  const now = new Date()

  return `${now.getFullYear().toString().padStart(4, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
}

export function addDays(value: string, days: number): string {
  return dateValue(new Date(parseDate(value)!.getTime() + days * dayMs))
}

export function addMonths(value: string, months: number): string {
  const date = parseDate(value)!
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const last = new Date(date.getTime())
  last.setUTCMonth(last.getUTCMonth() + 1)
  last.setUTCDate(0)
  date.setUTCDate(Math.min(day, last.getUTCDate()))

  return dateValue(date)
}

export function calendarDays(month: string, weekStartsOn: number): (string | undefined)[][] {
  const first = `${month.slice(0, 7)}-01`
  const offset = (parseDate(first)!.getUTCDay() - weekStartsOn + 7) % 7
  const start = parseDate(first)!.getTime() - offset * dayMs

  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = new Date(start + (week * 7 + day) * dayMs)
      return date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999 ? undefined : dateValue(date)
    }),
  )
}
