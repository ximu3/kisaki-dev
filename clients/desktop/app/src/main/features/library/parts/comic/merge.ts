import { eq, max } from 'drizzle-orm'
import type { PartRef } from '@kisaki3/desktop-contracts/library'
import { comicVolumeChapters as chapters } from '../../../../infrastructure/database/schema'
import type { LibraryDatabase } from '../../transaction'

export function mergeChapterMemberships(
  db: LibraryDatabase,
  source: PartRef,
  target: PartRef<'comicChapter' | 'comicVolume'>,
) {
  if (target.type === 'comicVolume') {
    const sourceRows = db
      .select()
      .from(chapters)
      .where(eq(chapters.volumeId, source.id))
      .orderBy(chapters.sortOrder, chapters.chapterId)
      .all()
    let order =
      (db
        .select({ n: max(chapters.sortOrder) })
        .from(chapters)
        .where(eq(chapters.volumeId, target.id))
        .get()!.n ?? -1) + 1
    for (const row of sourceRows) {
      if (
        db
          .insert(chapters)
          .values({ ...row, volumeId: target.id, sortOrder: order })
          .onConflictDoNothing()
          .run().changes
      ) {
        order++
      }
    }
  } else if (target.type === 'comicChapter') {
    const sourceRows = db.select().from(chapters).where(eq(chapters.chapterId, source.id)).all()
    for (const row of sourceRows) {
      db.insert(chapters)
        .values({ ...row, chapterId: target.id })
        .onConflictDoNothing()
        .run()
    }
  }
}
