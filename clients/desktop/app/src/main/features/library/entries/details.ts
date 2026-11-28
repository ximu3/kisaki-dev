import { and, eq } from 'drizzle-orm'
import { isWorkType, parseEntryDetails, type EntryRef } from '@kisaki3/desktop-contracts/library'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { entries, entryEvaluations } from '../../../infrastructure/database/schema'
import { readIdentities } from './identities'
import { catalogTables, entryWhere } from './tables'
import { workTotals } from '../records/work'
import type { LibraryDatabase } from '../transaction'

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
