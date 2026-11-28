import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { ContentDirectory, WorkRef } from '@kisaki3/desktop-contracts/library'
import { and, eq } from 'drizzle-orm'
import { entries } from '../../../../infrastructure/database/schema'
import { entryWhere } from '../../entries/tables'
import type { LibraryDatabase } from '../../transaction'
import { directories } from './tables'

export function readDirectories(
  db: LibraryDatabase,
  work: WorkRef,
  sensitive: boolean,
): ContentDirectory[] {
  if (
    !db
      .select({ id: entries.id })
      .from(entries)
      .where(and(entryWhere(work), sensitive ? undefined : eq(entries.isNsfw, false)))
      .get()
  ) {
    throw new DesktopError('NotFound', 'The work is unavailable')
  }
  const { table, owner } = directories[work.type]
  return db
    .select()
    .from(table)
    .where(eq(owner, work.id))
    .orderBy(table.createdAt, table.id)
    .all()
    .map((row) => {
      const result = { ...row, work }
      Reflect.deleteProperty(result, work.type + 'Id')
      return result as ContentDirectory
    })
}
