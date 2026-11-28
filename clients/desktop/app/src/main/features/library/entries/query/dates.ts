import { sql, type SQL } from 'drizzle-orm'
import { daysInMonth, type CalendarDate, type PartialDate } from '@kisaki3/desktop-contracts/date'
import type { DateTest, BirthdayTest, InstantTest } from '@kisaki3/desktop-contracts/library'

export function calendarKey(date: PartialDate, end: boolean) {
  if (date.year === undefined) {
    return null
  }
  const month = date.month ?? (end ? 12 : 1)
  const day = date.day ?? (end ? daysInMonth(month, date.year) : 1)
  return date.year * 10000 + month * 100 + day
}

export function compareRange(value: SQL, bounds: { min?: number; max?: number }) {
  const conditions: SQL[] = []
  if (bounds.min !== undefined) {
    conditions.push(sql`${value}>=${bounds.min}`)
  }
  if (bounds.max !== undefined) {
    conditions.push(sql`${value}<=${bounds.max}`)
  }
  return sql`(${sql.join(conditions, sql` and `)})`
}

export function localDate(value: SQL) {
  const date = sql`date(${value}/1000.0,'unixepoch','localtime')`
  return sql`case when ${value} is not null then json_object('year',cast(substr(${date},1,4) as integer),'month',cast(substr(${date},6,2) as integer),'day',cast(substr(${date},9,2) as integer)) end`
}

function component(value: SQL, key: keyof CalendarDate) {
  return sql`json_extract(${value},${'$.' + key})`
}

export function dateTest(value: SQL, test: DateTest | BirthdayTest): SQL {
  if (test.op === 'present') {
    return sql`${value} is not null`
  }
  if (test.op === 'absent') {
    return sql`${value} is null`
  }
  if ('component' in test) {
    const part = component(value, test.component)
    if (test.op === 'componentRange') {
      return compareRange(part, test.bounds)
    }
    return test.op === 'componentPresent' ? sql`${part} is not null` : sql`${part} is null`
  }
  if (test.op === 'monthDayRange') {
    const day = sql`(${component(value, 'month')}*100+${component(value, 'day')})`
    const min = test.from.month * 100 + (test.from.day ?? 1)
    const max = test.to.month * 100 + (test.to.day ?? daysInMonth(test.to.month))
    return min <= max ? compareRange(day, { min, max }) : sql`(${day}>=${min} or ${day}<=${max})`
  }
  const year = component(value, 'year')
  const month = component(value, 'month')
  const day = component(value, 'day')
  const checks = [sql`${year} is not null`]
  if (test.bounds.min) {
    const start = sql`(${year}*10000+coalesce(${month},1)*100+coalesce(${day},1))`
    checks.push(sql`${start}>=${calendarKey(test.bounds.min, false)}`)
  }
  if (test.bounds.max) {
    const monthEnd = sql`cast(strftime('%d',date(printf('%04d-%02d-01',${year},coalesce(${month},12)),'+1 month','-1 day')) as integer)`
    const end = sql`(${year}*10000+coalesce(${month},12)*100+coalesce(${day},${monthEnd}))`
    checks.push(sql`${end}<=${calendarKey(test.bounds.max, true)}`)
  }
  return sql`(${sql.join(checks, sql` and `)})`
}

export function instantTest(value: SQL, test: InstantTest) {
  if (test.op === 'calendarRange') {
    return dateTest(localDate(value), { op: 'absoluteRange', bounds: test.bounds })
  }
  if (test.op === 'present') {
    return sql`${value} is not null`
  }
  if (test.op === 'absent') {
    return sql`${value} is null`
  }
  const conditions: SQL[] = []
  if (test.from !== undefined) {
    conditions.push(sql`${value}>=${test.from}`)
  }
  if (test.to !== undefined) {
    conditions.push(sql`${value}<${test.to}`)
  }
  return sql`(${sql.join(conditions, sql` and `)})`
}
