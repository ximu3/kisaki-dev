import { and, count, desc, eq, sql } from 'drizzle-orm'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import type { WorkCompletion, WorkRef } from '@kisaki3/desktop-contracts/library'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  entries,
  workCompletionRecords as records,
} from '../../../../infrastructure/database/schema'
import type { LibraryDatabase } from '../../transaction'
import { entryWhere } from '../../entries/tables'

function owner(db: LibraryDatabase, work: WorkRef, showSensitive: boolean) {
  return db
    .select({ id: entries.id })
    .from(entries)
    .where(and(entryWhere(work), showSensitive ? undefined : eq(entries.isNsfw, false)))
    .get()
}

function saved(work: WorkRef, row: typeof records.$inferSelect): WorkCompletion {
  return {
    work,
    id: row.id,
    completedDate: row.completedDate,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function getCompletion(
  db: LibraryDatabase,
  work: WorkRef,
  id: string,
  showSensitive: boolean,
) {
  if (!owner(db, work, showSensitive)) {
    return null
  }
  const row = db
    .select()
    .from(records)
    .where(and(eq(records.id, id), eq(records.workId, work.id)))
    .get()
  return row ? saved(work, row) : null
}

export function listCompletions(
  db: LibraryDatabase,
  work: WorkRef,
  options: ListOptions,
  showSensitive: boolean,
) {
  if (!owner(db, work, showSensitive)) {
    throw new DesktopError('NotFound', 'The work is unavailable')
  }
  const where = eq(records.workId, work.id)
  const rows = db
    .select()
    .from(records)
    .where(where)
    .orderBy(
      desc(sql`json_extract(${records.completedDate},'$.year')`),
      desc(sql`json_extract(${records.completedDate},'$.month')`),
      desc(sql`json_extract(${records.completedDate},'$.day')`),
      desc(records.createdAt),
      records.id,
    )
    .limit(options.limit)
    .offset(options.offset)
    .all()
  return {
    items: rows.map((row) => saved(work, row)),
    total: db.select({ n: count() }).from(records).where(where).get()!.n,
  }
}
