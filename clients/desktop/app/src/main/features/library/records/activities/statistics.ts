import type { CalendarDate } from '@kisaki3/desktop-contracts/date'
import type { ActivityStatistics, WorkType } from '@kisaki3/desktop-contracts/library'
import type { ActivityStatsQuery } from './query'

interface Amount {
  type: WorkType
  workId: string
  durationMs: number | bigint
}

interface Event extends Amount {
  startedAt: number | bigint
  endedAt: number | bigint
}

const dayMs = 86400000

function calendar(time: Date): CalendarDate {
  return { year: time.getFullYear(), month: time.getMonth() + 1, day: time.getDate() }
}

function dayNumber(day: CalendarDate) {
  const date = new Date(0)
  date.setUTCFullYear(day.year, day.month - 1, day.day)
  return Math.floor(date.getTime() / dayMs)
}

function bucket(time: Date, period: NonNullable<ActivityStatsQuery['groupBy']>) {
  const date = calendar(time)
  if (period === 'year') {
    return { date: { year: date.year, month: 1, day: 1 } }
  }
  if (period === 'month') {
    return { date: { ...date, day: 1 } }
  }
  if (period === 'week') {
    const monday = new Date(time)
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    return { date: calendar(monday) }
  }
  return period === 'hour' ? { date, hour: time.getHours() } : { date }
}

export function summarize(
  events: readonly Event[],
  additions: readonly Amount[],
  query: ActivityStatsQuery,
): ActivityStatistics {
  const groups = new Map<number, ActivityStatistics['groups'][number]>()
  const works = new Map<
    string,
    { work: { type: WorkType; id: string }; durationMs: number; activityCount: number }
  >()
  const days = new Set<number>()
  let duration = 0,
    longest: number | null = null,
    additional = 0
  function workRow(row: Amount) {
    let found = works.get(row.workId)
    if (!found) {
      found = { work: { type: row.type, id: row.workId }, durationMs: 0, activityCount: 0 }
      works.set(row.workId, found)
    }
    return found
  }

  for (const row of events) {
    const start = Number(row.startedAt),
      end = Number(row.endedAt)
    const from = Math.max(start, query.range?.from ?? start),
      to = Math.min(end, query.range?.to ?? end)
    const scale = Number(row.durationMs) / (end - start)
    const amount = (to - from) * scale,
      work = workRow(row)
    duration += amount
    work.durationMs += amount
    work.activityCount++
    longest = Math.max(longest ?? 0, amount)
    const counted = new Set<number>()
    for (let at = from; at < to;) {
      const here = new Date(at)
      const next = new Date(at)
      if (query.groupBy === 'hour') {
        next.setMinutes(60, 0, 0)
      } else {
        next.setHours(24, 0, 0, 0)
      }
      const until = Math.min(to, next.getTime())
      if (amount > 0) {
        days.add(dayNumber(calendar(here)))
      }
      if (query.groupBy) {
        const group = bucket(here, query.groupBy),
          key = dayNumber(group.date) * 24 + (group.hour ?? 0)
        const prev = groups.get(key)
        groups.set(key, {
          ...group,
          durationMs: (prev?.durationMs ?? 0) + (until - at) * scale,
          activityCount: (prev?.activityCount ?? 0) + (counted.has(key) ? 0 : 1),
        })
        counted.add(key)
      }
      at = until
    }
  }
  for (const row of additions) {
    const value = Number(row.durationMs)
    additional += value
    workRow(row).durationMs += value
  }
  let streak = 0,
    longestStreak = 0,
    previous: number | undefined
  for (const day of [...days].sort((a, b) => a - b)) {
    streak = day === Number(previous) + 1 ? streak + 1 : 1
    previous = day
    longestStreak = Math.max(streak, longestStreak)
  }
  return {
    activityCount: events.length,
    durationMs: duration + additional,
    additionalDurationMs: additional,
    averageDurationMs: events.length ? duration / events.length : null,
    longestDurationMs: longest,
    activeDayCount: days.size,
    longestStreakDays: longestStreak,
    groups: [...groups].sort(([a], [b]) => a - b).map(([, value]) => value),
    works: [...works.values()].sort(
      (a, b) => b.durationMs - a.durationMs || a.work.id.localeCompare(b.work.id),
    ),
  }
}
