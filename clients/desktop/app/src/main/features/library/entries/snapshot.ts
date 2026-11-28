import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { EntryRef } from '@kisaki3/desktop-contracts/library'
import * as s from '../../../infrastructure/database/schema'
import type { LibraryDatabase } from '../transaction'
import { readIdentities } from './external-ids'
import { entryWhere } from './tables'

export function snapshot(db: LibraryDatabase, ref: EntryRef) {
  const row = db.select({ name: s.entries.name }).from(s.entries).where(entryWhere(ref)).get()
  if (!row) {
    throw new DesktopError('NotFound', 'A selected entry no longer exists')
  }
  return { ref, name: row.name, externalIdentities: readIdentities(db, ref.id) }
}
