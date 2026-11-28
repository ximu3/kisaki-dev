import { eq } from 'drizzle-orm'
import { comicVolumeChapters } from '../../../../infrastructure/database/schema'
import type { LibraryDatabase } from '../../transaction'

export function chapterNumbers(db: LibraryDatabase, comicId: string) {
  const members = new Map<string, { id: string; number: string | null }[]>()
  for (const row of db
    .select()
    .from(comicVolumeChapters)
    .where(eq(comicVolumeChapters.comicId, comicId))
    .all()) {
    const rows = members.get(row.chapterId) ?? []
    rows.push({ id: row.volumeId, number: row.numberLabel })
    members.set(row.chapterId, rows)
  }
  return members
}
