import { and, asc, count, desc, eq, isNotNull, sql } from 'drizzle-orm'
import type { WorkRef, WorkRecord } from '@kisaki3/desktop-contracts/library'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { workCompletionRecords } from '../../../infrastructure/database/schema'
import { activityTables, recordTables } from '../entries/tables'
import type { LibraryDatabase } from '../transaction'

export function readWorkRecord(db: LibraryDatabase, work: WorkRef): WorkRecord {
  const table = recordTables[work.type]
  return (
    db
      .select({
        status: table.status,
        additionalDurationMs: table.additionalDurationMs,
        additionalCompletionCount: table.additionalCompletionCount,
      })
      .from(table)
      .where(eq(table.workId, work.id))
      .get() ?? {
      status: null,
      additionalDurationMs: 0,
      additionalCompletionCount: 0,
    }
  )
}

export function completionTotal(db: LibraryDatabase, id: string, additional: number) {
  const { detailed } = db
    .select({ detailed: count() })
    .from(workCompletionRecords)
    .where(eq(workCompletionRecords.workId, id))
    .get()!
  const total = detailed + additional
  if (!Number.isSafeInteger(total)) {
    throw new DesktopError('InvalidInput', 'Completion total exceeds the supported integer range')
  }
  return total
}

export function saveWorkRecord(db: LibraryDatabase, work: WorkRef, value: WorkRecord) {
  const table = recordTables[work.type]
  completionTotal(db, work.id, value.additionalCompletionCount)
  db.insert(table)
    .values({ workId: work.id, ...value })
    .onConflictDoUpdate({ target: table.workId, set: value })
    .run()
}

export function workTotals(db: LibraryDatabase, work: WorkRef) {
  const record = readWorkRecord(db, work)
  const { table, owner } = activityTables[work.type]
  const activity = db
    .select({
      totalDurationMs: sql`coalesce(sum(${table.durationMs}),0)`.mapWith(Number),
      lastActiveAt: sql`max(${table.endedAt})`.mapWith(table.endedAt),
    })
    .from(table)
    .where(eq(owner, work.id))
    .get()!

  function boundary(order: typeof asc) {
    const { completedDate, workId } = workCompletionRecords
    return (
      db
        .select({ date: completedDate })
        .from(workCompletionRecords)
        .where(and(eq(workId, work.id), isNotNull(completedDate)))
        .orderBy(
          order(sql`json_extract(${completedDate}, '$.year')`),
          order(sql`json_extract(${completedDate}, '$.month')`),
          order(sql`json_extract(${completedDate}, '$.day')`),
        )
        .limit(1)
        .get()?.date ?? null
    )
  }

  return {
    record,
    totalDurationMs: activity.totalDurationMs + record.additionalDurationMs,
    lastActiveAt: activity.lastActiveAt,
    completionCount: completionTotal(db, work.id, record.additionalCompletionCount),
    firstCompletedDate: boundary(asc),
    lastCompletedDate: boundary(desc),
  }
}
