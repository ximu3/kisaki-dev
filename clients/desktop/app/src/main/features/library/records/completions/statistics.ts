import { sql } from 'drizzle-orm'
import * as v from 'valibot'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseEntryCondition,
  type CompletionStatistics,
  type CompletionsApi,
} from '@kisaki3/desktop-contracts/library'
import type { CalendarDate } from '@kisaki3/desktop-contracts/date'
import { dateTest } from '../../entries/query/dates'
import { statisticsScope, workSet } from '../scope'
import type { LibraryDatabase } from '../../transaction'

type Query = Parameters<CompletionsApi['statistics']>[0]
export function completionQuery(input: unknown): Query {
  const raw = v.safeParse(
    v.strictObject({
      scope: v.unknown(),
      completedDate: v.exactOptional(v.unknown()),
      groupBy: v.exactOptional(v.picklist(['year', 'month', 'day'])),
    }),
    input,
  )
  if (!raw.success) {
    throw new DesktopError('InvalidInput', 'Invalid completion statistics query')
  }
  const q = raw.output
  const condition =
    'completedDate' in q
      ? parseEntryCondition({
          field: 'completions',
          match: 'exists',
          where: { completedDate: q.completedDate },
        })
      : undefined
  return {
    scope: statisticsScope(q.scope),
    ...(q.groupBy && { groupBy: q.groupBy }),
    ...(condition?.field === 'completions' &&
      condition.where.completedDate && { completedDate: condition.where.completedDate }),
  }
}
export function completionStats(
  db: LibraryDatabase,
  query: Query,
  sensitive: boolean,
): CompletionStatistics {
  const scope = workSet(db, query.scope, sensitive)
  const date = sql`r.completed_date`
  const condition = query.completedDate ? dateTest(date, query.completedDate) : sql`1`
  const additional = ['game', 'anime', 'comic', 'novel'].map(
    (type) =>
      sql`select ${sql.identifier(type + '_id')} work_id,null completed_date,additional_completion_count n from ${sql.identifier(type + '_records')} where additional_completion_count>0`,
  )
  const unknown = !query.completedDate || query.completedDate.op === 'absent'
  const facts = sql`with scope as (${scope}), facts as (
 select r.work_id,r.completed_date,1 n from work_completion_records r join scope s on s.id=r.work_id where ${condition}
 ${unknown ? sql`union all select a.work_id,null,a.n from (${sql.join(additional, sql` union all `)}) a join scope s on s.id=a.work_id` : sql.empty()})`
  const rows = db.all<{ work: string; date: string | null; n: bigint }>(
    sql`${facts} select work_id work,completed_date date,sum(n) n from facts group by work_id,completed_date`,
  )
  const works = new Set<string>()
  let total = 0,
    unknownDates = 0,
    first: CalendarDate | null = null,
    last: CalendarDate | null = null
  const by = new Map<number, { date: CalendarDate; count: number; works: Set<string> }>()
  const key = (date: CalendarDate) => date.year * 10000 + date.month * 100 + date.day
  for (const row of rows) {
    total += Number(row.n)
    works.add(row.work)
    if (row.date === null) {
      unknownDates += Number(row.n)
      continue
    }
    const date = JSON.parse(row.date) as CalendarDate
    if (!first || key(date) < key(first)) {
      first = date
    }
    if (!last || key(date) > key(last)) {
      last = date
    }
    if (!query.groupBy) {
      continue
    }
    let group = key(date)
    if (query.groupBy === 'year') {
      group = date.year
    }
    if (query.groupBy === 'month') {
      group = date.year * 100 + date.month
    }
    const found = by.get(group) ?? { date, count: 0, works: new Set<string>() }
    found.count += Number(row.n)
    found.works.add(row.work)
    by.set(group, found)
  }
  const groups = [...by]
    .sort(([a], [b]) => a - b)
    .map(([, group]) => {
      let date: CompletionStatistics['groups'][number]['date'] = group.date
      if (query.groupBy === 'year') {
        date = { year: group.date.year }
      }
      if (query.groupBy === 'month') {
        date = { year: group.date.year, month: group.date.month }
      }
      return { date, completionCount: group.count, workCount: group.works.size }
    })
  return {
    completionCount: total,
    workCount: works.size,
    unknownDateCount: unknownDates,
    firstCompletedDate: first,
    lastCompletedDate: last,
    groups,
  }
}
