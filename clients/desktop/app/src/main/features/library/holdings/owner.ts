import { and, eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { WorkRef, ExternalIdentity } from '@kisaki3/desktop-contracts/library'
import { entries } from '../../../infrastructure/database/schema'
import { requireEntry, entryWhere } from '../entries/tables'
import { findIdentity } from '../entries/identities'
import type { LibraryDatabase } from '../transaction'

export function expectOwner(
  db: LibraryDatabase,
  work: WorkRef,
  identities?: readonly ExternalIdentity[],
) {
  requireEntry(db, work)
  for (const identity of identities ?? []) {
    const owner = findIdentity(db, identity)
    if (owner?.id !== work.id || owner.type !== work.type) {
      throw new DesktopError('Conflict', 'The external identity no longer belongs to this work')
    }
  }
}

export function visibleWork(db: LibraryDatabase, work: WorkRef, sensitive: boolean) {
  return !!db
    .select({ id: entries.id })
    .from(entries)
    .where(and(entryWhere(work), sensitive ? undefined : eq(entries.isNsfw, false)))
    .get()
}
