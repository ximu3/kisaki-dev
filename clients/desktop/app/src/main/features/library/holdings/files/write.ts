import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { FileAvailability, FileCreateFields } from '@kisaki3/desktop-contracts/library'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { ready } from '../../../../infrastructure/database/codecs/json'
import { requireEntry } from '../../entries/tables'
import type { LibraryWrite } from '../../transaction'
import { editAssociations, preferFile } from './associations'
import { type FileFacts, type FileWork, fileChange, fileRow, storeFileFacts } from './record'
import { mediaFiles } from './tables'

export function addFile(
  write: LibraryWrite,
  work: FileWork,
  input: FileCreateFields,
  facts: FileFacts,
) {
  requireEntry(write.db, work)
  const id = randomUUID()
  const values = {
    id,
    path: input.path,
    note: input.note ?? null,
    associationMode: input.associations ? ('manual' as const) : ('automatic' as const),
    availability: ready<FileAvailability>({ status: 'accessible', checkedAt: write.now }),
    createdAt: write.now,
    updatedAt: write.now,
  }
  if (work.type === 'anime') {
    if (!('video' in facts)) {
      throw new DesktopError('InvalidInput', 'Choose a video file')
    }
    write.db
      .insert(mediaFiles.anime.table)
      .values({ ...values, animeId: work.id, metadata: ready(facts.video) })
      .run()
  } else {
    if (!('book' in facts)) {
      throw new DesktopError('InvalidInput', 'Choose a reading target')
    }
    const book = { ...values, kind: facts.kind, metadata: ready(facts.book) }
    if (work.type === 'comic') {
      write.db
        .insert(mediaFiles.comic.table)
        .values({ ...book, comicId: work.id })
        .run()
    } else {
      write.db
        .insert(mediaFiles.novel.table)
        .values({ ...book, novelId: work.id })
        .run()
    }
  }
  if (input.associations) {
    editAssociations(
      write,
      work,
      id,
      { change: { type: 'replace', items: input.associations } },
      true,
    )
  }
  if (input.isPreferred) {
    preferFile(write, work, { scope: { type: 'work' }, fileId: id })
  }
  fileChange(write, work, [id])
  return id
}

export function moveFile(
  write: LibraryWrite,
  work: FileWork,
  id: string,
  path: string,
  facts: FileFacts,
) {
  const row = fileRow(write.db, work, id)
  if (('kind' in row ? row.kind : 'file') !== facts.kind) {
    throw new DesktopError('InvalidReference', 'The destination must be the same content type')
  }
  if (row.path === path) {
    return
  }
  const table = mediaFiles[work.type].table
  write.db
    .update(table)
    .set({
      path,
      availability: ready<FileAvailability>({ status: 'accessible', checkedAt: write.now }),
      updatedAt: write.now,
    })
    .where(eq(table.id, id))
    .run()
  storeFileFacts(write.db, work, id, facts)
  fileChange(write, work, [id])
}
