import { eq } from 'drizzle-orm'
import {
  collectionDescriptionAttachments,
  tagDescriptionAttachments,
} from '../../../infrastructure/database/schema'
import { inlineImages } from '../attachments'
import type { LibraryWrite } from '../transaction'
export function storeDescription(
  write: LibraryWrite,
  kind: 'collection' | 'tag',
  id: string,
  text: string | null,
) {
  const table = kind === 'collection' ? collectionDescriptionAttachments : tagDescriptionAttachments
  const before = write.db
    .delete(table)
    .where(eq(table.ownerId, id))
    .returning({ image: table.attachmentId })
    .all()
  const used = new Set(inlineImages(text))
  for (const { image } of before) {
    if (!used.has(image)) {
      write.released.add(image)
    }
  }
  for (const attachmentId of used) {
    write.db.insert(table).values({ ownerId: id, attachmentId }).run()
  }
}
