import type { EntryRef } from '@kisaki3/desktop-contracts/library'
import { eq } from 'drizzle-orm'
import * as s from '../../../infrastructure/database/schema'
import { imageIds } from '../attachments'
import type { LibraryWrite } from '../transaction'
import { catalogTables, entryWhere } from './tables'

export function retireEntryImages(write: LibraryWrite, ref: EntryRef) {
  const { db } = write,
    sub = catalogTables[ref.type]
  const base = db.select().from(s.entries).where(entryWhere(ref)).get()!,
    detail = db.select().from(sub).where(eq(sub.entryId, ref.id)).get()
  for (const image of imageIds({ ...base, ...detail })) {
    write.released.add(image)
  }
}
