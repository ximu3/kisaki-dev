import { and, eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { FileMergeInput, FileAvailability } from '@kisaki3/desktop-contracts/library'
import { ready } from '../../../../infrastructure/database/codecs/json'
import { parts } from '../../parts/tables'
import type { LibraryWrite } from '../../transaction'
import { mediaFiles } from '../tables'
import { fileRow, directLinks, storeFileFacts, type FileWork, type FileFacts } from './storage'

export function mergeFile(
  write: LibraryWrite,
  work: FileWork,
  input: FileMergeInput,
  facts: FileFacts,
  sourceWork: FileWork = work,
) {
  const { db } = write
  const source = fileRow(db, sourceWork, input.sourceFileId),
    target = fileRow(db, work, input.targetFileId)
  const sourceKind = 'kind' in source ? source.kind : 'file',
    targetKind = 'kind' in target ? target.kind : 'file'
  if (sourceKind !== targetKind || facts.kind !== targetKind) {
    throw new DesktopError(
      'InvalidReference',
      'The two registrations must describe the same type of content',
    )
  }
  const schema = mediaFiles[work.type]
  for (const link of directLinks(db, sourceWork, source.id)) {
    const table = parts[link.part.type].files
    db.delete(table)
      .where(and(eq(table.fileId, source.id), eq(table.partId, link.part.id)))
      .run()
    const add = db.insert(table).values({
      workId: work.id,
      fileId: target.id,
      partId: link.part.id,
      isPreferred: link.isPreferred,
    })
    if (link.isPreferred) {
      add
        .onConflictDoUpdate({ target: [table.fileId, table.partId], set: { isPreferred: true } })
        .run()
    } else {
      add.onConflictDoNothing().run()
    }
  }
  db.update(schema.activity)
    .set({ fileId: target.id })
    .where(eq(schema.activity.fileId, source.id))
    .run()
  db.update(schema.annotation)
    .set({ fileId: target.id })
    .where(eq(schema.annotation.fileId, source.id))
    .run()
  db.delete(schema.table).where(eq(schema.table.id, source.id)).run()
  const note =
    [
      ...new Set(
        [target.note, source.note].filter(
          (value): value is string => value !== null && !!value.trim(),
        ),
      ),
    ].join('\n\n') || null
  storeFileFacts(db, work, target.id, facts)
  db.update(schema.table)
    .set({
      path: input.path,
      note,
      isPreferred: target.isPreferred || source.isPreferred,
      associationMode: 'manual',
      availability: ready<FileAvailability>({ status: 'accessible', checkedAt: write.now }),
      updatedAt: write.now,
    })
    .where(eq(schema.table.id, target.id))
    .run()
  write.changes.push({
    type: 'holdingsChanged',
    work,
    fileIds: [source.id, target.id],
    fileMerged: { sourceFileId: source.id, targetFileId: target.id },
  } as Extract<LibraryWrite['changes'][number], { type: 'holdingsChanged' }>)
  return { fileId: target.id, removedFileId: source.id, path: input.path }
}
