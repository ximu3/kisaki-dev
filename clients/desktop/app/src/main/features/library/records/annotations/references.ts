import type { FileWorkType, WorkRef } from '@kisaki3/desktop-contracts/library'
import { eq, sql } from 'drizzle-orm'
import type { LibraryWrite } from '../../transaction'
import { tables as annotationTables } from './read'

export function releaseAnnotationImages(write: LibraryWrite, ref: WorkRef) {
  const { db } = write
  const annotation = annotationTables[ref.type]
  for (const row of db.all<{ id: string }>(
    sql`select image_id id from ${annotation.table} where ${annotation.owner}=${ref.id} and image_id is not null union select attachment_id from ${annotation.images} where ${annotation.images.ownerId} in (select id from ${annotation.table} where ${annotation.owner}=${ref.id})`,
  )) {
    write.released.add(row.id)
  }
}

export function moveWorkAnnotations(write: LibraryWrite, source: WorkRef, target: WorkRef) {
  const { db } = write
  const annotations = annotationTables[target.type]
  db.run(
    sql`update ${annotations.table} set ${sql.identifier(annotations.owner.name)}=${target.id} where ${annotations.owner}=${source.id}`,
  )
}

export function moveFileAnnotations(
  write: LibraryWrite,
  type: FileWorkType,
  from: string,
  to: string,
) {
  const { table } = annotationTables[type]
  write.db.update(table).set({ fileId: to }).where(eq(table.fileId, from)).run()
}
