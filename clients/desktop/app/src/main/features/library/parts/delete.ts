import type { PartRef } from '@kisaki3/desktop-contracts/library'
import { eq } from 'drizzle-orm'
import type { LibraryWrite } from '../transaction'
import { releasePartImages } from './images'
import { parts } from './tables'
import { requirePart } from './write'

export function removePart(write: LibraryWrite, ref: PartRef) {
  const row = requirePart(write.db, ref)
  releasePartImages(write, row)
  const schema = parts[ref.type]
  write.db.delete(schema.table).where(eq(schema.table.id, ref.id)).run()
  write.changes.push({ type: 'partDeleted', part: ref, work: row.work } as Extract<
    LibraryWrite['changes'][number],
    { type: 'partCreated' | 'partUpdated' | 'partDeleted' | 'partRecordChanged' }
  >)
}
