import { and, eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  FileWorkType,
  WorkRef,
  AnimeFileMetadata,
  ReadingFileMetadata,
} from '@kisaki3/desktop-contracts/library'
import { ready } from '../../../../infrastructure/database/codecs/json'
import type { LibraryDatabase, LibraryWrite } from '../../transaction'
import { mediaFiles } from '../tables'

export type FileFacts =
  | { kind: 'file'; video: AnimeFileMetadata }
  | { kind: 'file' | 'directory'; book: ReadingFileMetadata }
export type FileWork = WorkRef<FileWorkType>
export function storeFileFacts(db: LibraryDatabase, work: FileWork, id: string, facts: FileFacts) {
  if ('video' in facts) {
    if (work.type !== 'anime') {
      throw new DesktopError('InvalidReference', 'Video metadata belongs to an anime file')
    }
    const table = mediaFiles.anime.table
    db.update(table)
      .set({ metadata: ready(facts.video) })
      .where(eq(table.id, id))
      .run()
  } else {
    if (work.type === 'anime') {
      throw new DesktopError('InvalidReference', 'Reading metadata belongs to a reading file')
    }
    const table = mediaFiles[work.type].table
    db.update(table)
      .set({ metadata: ready(facts.book) })
      .where(eq(table.id, id))
      .run()
  }
}

export function fileChange(write: LibraryWrite, work: FileWork, ids: readonly string[]) {
  if (ids.length) {
    write.changes.push({ type: 'holdingsChanged', work, fileIds: ids } as Extract<
      LibraryWrite['changes'][number],
      { type: 'holdingsChanged' }
    >)
  }
}

export function fileRow(db: LibraryDatabase, work: FileWork, id: string) {
  const { table, owner } = mediaFiles[work.type]
  const row = db
    .select()
    .from(table)
    .where(and(eq(owner, work.id), eq(table.id, id)))
    .get()
  if (!row) {
    throw new DesktopError('InvalidReference', 'The file is not registered for this work')
  }
  return row
}
