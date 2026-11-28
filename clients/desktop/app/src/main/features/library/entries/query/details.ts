import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  isWorkType,
  parseEntryDetails,
  type EntryRef,
  type WorkRef,
} from '@kisaki3/desktop-contracts/library'
import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm'
import {
  entries,
  entryEvaluations,
  workCompletionRecords,
} from '../../../../infrastructure/database/schema'
import { activityTables } from '../../records/activities/tables'
import { completionTotal } from '../../records/completions/read'
import type { LibraryDatabase } from '../../transaction'
import { readIdentities } from '../external-ids'
import { readWorkRecord } from '../personal'
import { catalogTables, entryWhere } from '../tables'

export function readEvaluation(db: LibraryDatabase, id: string) {
  return (
    db
      .select({ rating: entryEvaluations.rating, favorite: entryEvaluations.favorite })
      .from(entryEvaluations)
      .where(eq(entryEvaluations.entryId, id))
      .get() ?? { rating: null, favorite: false }
  )
}

export function readDetails(db: LibraryDatabase, ref: EntryRef, showSensitive: boolean) {
  const base = db
    .select()
    .from(entries)
    .where(and(entryWhere(ref), showSensitive ? undefined : eq(entries.isNsfw, false)))
    .get()
  if (!base) {
    return null
  }

  const table = catalogTables[ref.type]
  const specific = db.select().from(table).where(eq(table.entryId, ref.id)).get()
  if (!specific) {
    throw new DesktopError('DataIntegrityError', 'The entry is missing its type data')
  }

  const fields = Object.fromEntries(
    Object.entries(specific).filter(([key]) => key !== 'entryId' && key !== 'entryType'),
  )
  const common = Object.fromEntries(
    Object.entries(base).filter(([key]) => key !== 'description' && key !== 'effectiveSortName'),
  )
  return parseEntryDetails({
    ...common,
    ...fields,
    externalIdentities: readIdentities(db, ref.id),
    evaluation: readEvaluation(db, ref.id),
    ...(isWorkType(ref.type) && workTotals(db, { type: ref.type, id: ref.id })),
  })
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
