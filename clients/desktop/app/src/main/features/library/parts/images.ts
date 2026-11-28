import { eq } from 'drizzle-orm'
import type { PartDetails } from '@kisaki3/desktop-contracts/library'
import type { LibraryWrite } from '../transaction'
import { parts } from './tables'

export function releasePartImages(write: LibraryWrite, row: PartDetails) {
  if (row.data.primaryImageId) {
    write.released.add(row.data.primaryImageId)
  }
  const links = parts[row.ref.type].images
  for (const image of write.db
    .select({ id: links.attachmentId })
    .from(links)
    .where(eq(links.ownerId, row.ref.id))
    .all()) {
    write.released.add(image.id)
  }
}
