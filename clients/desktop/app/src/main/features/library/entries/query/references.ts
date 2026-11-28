import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { EntryQuery, QueryReferenceLabel } from '@kisaki3/desktop-contracts/library'
import { eq, sql } from 'drizzle-orm'
import { collections, entries, notes, tags } from '../../../../infrastructure/database/schema'
import { referencedTargets, type QueryReference } from '../../query-references'
import type { LibraryDatabase } from '../../transaction'

function resolveReference(
  db: LibraryDatabase,
  { target, manual }: QueryReference,
  sensitive: boolean,
) {
  if (target.type === 'note') {
    return db.select({ name: notes.title }).from(notes).where(eq(notes.id, target.id)).get()
  }
  if (target.type === 'collection') {
    const row = db
      .select({
        mode: collections.membershipMode,
        name: sql<
          string | null
        >`case when ${Number(sensitive)} or not ${collections.isNsfw} then ${collections.name} end`,
      })
      .from(collections)
      .where(eq(collections.id, target.id))
      .get()
    return row && (!manual || row.mode === 'manual') ? row : undefined
  }
  if (target.type === 'tag') {
    return db
      .select({
        name: sql<
          string | null
        >`case when ${Number(sensitive)} or not ${tags.isNsfw} then ${tags.name} end`,
      })
      .from(tags)
      .where(eq(tags.id, target.id))
      .get()
  }
  const row = db
    .select({
      type: entries.type,
      name: sql<
        string | null
      >`case when ${Number(sensitive)} or not ${entries.isNsfw} then ${entries.name} end`,
    })
    .from(entries)
    .where(eq(entries.id, target.id))
    .get()
  return row?.type === target.type ? row : undefined
}

export function queryReferences(
  db: LibraryDatabase,
  query: Pick<EntryQuery, 'rules' | 'scope'>,
  sensitive: boolean,
  previous?: readonly QueryReferenceLabel[],
) {
  const labels: QueryReferenceLabel[] = []
  for (const ref of referencedTargets(query.scope, query.rules)) {
    if (!ref.required && !previous) {
      continue
    }
    const saved = resolveReference(db, ref, sensitive)
    if (!saved && ref.required) {
      throw new DesktopError(
        'InvalidReference',
        'A referenced library item no longer exists in the required scope',
      )
    }
    if (previous) {
      const name =
        saved?.name ??
        previous.find(
          (row) => row.target.type === ref.target.type && row.target.id === ref.target.id,
        )?.name
      if (name) {
        labels.push({ target: ref.target, name })
      }
    }
  }
  return labels
}
