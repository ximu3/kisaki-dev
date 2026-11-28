import {
  partTypes,
  partWorkType,
  type PartDetails,
  type WorkRef,
} from '@kisaki3/desktop-contracts/library'
import { eq, sql } from 'drizzle-orm'
import type { LibraryWrite } from '../transaction'
import { parts } from './tables'

export function releaseWorkPartImages(write: LibraryWrite, ref: WorkRef) {
  const { db } = write
  for (const type of partTypes.filter((kind) => partWorkType(kind) === ref.type)) {
    const p = parts[type]
    for (const row of db.all<{ id: string }>(
      sql`select primary_image_id id from ${p.table} where ${p.owner}=${ref.id} and primary_image_id is not null union select attachment_id from ${p.images} where ${p.images.ownerId} in (select id from ${p.table} where ${p.owner}=${ref.id})`,
    )) {
      write.released.add(row.id)
    }
  }
}

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
