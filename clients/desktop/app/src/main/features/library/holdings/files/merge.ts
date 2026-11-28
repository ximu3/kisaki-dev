import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { FileAvailability, FileMergeInput } from '@kisaki3/desktop-contracts/library'
import { and, eq, sql } from 'drizzle-orm'
import { ready } from '../../../../infrastructure/database/codecs/json'
import { parts } from '../../parts/tables'
import { moveFileActivities } from '../../records/activities/references'
import { moveFileAnnotations } from '../../records/annotations/references'
import { mergeText } from '../../text'
import type { LibraryWrite } from '../../transaction'
import { directLinks } from './associations'
import { fileRow, storeFileFacts, type FileFacts, type FileWork } from './record'
import { mediaFiles } from './tables'

export interface DuplicateFile {
  sourceWork: string
  sourceFileId: string
  targetFileId: string
  path: string
  facts: FileFacts
}

export function moveWorkFiles(
  write: LibraryWrite,
  source: FileWork,
  target: FileWork,
  duplicates: readonly DuplicateFile[],
) {
  const { db } = write
  const f = mediaFiles[target.type],
    preference = db
      .select({ id: f.table.id })
      .from(f.table)
      .where(and(eq(f.owner, target.id), eq(f.table.isPreferred, true)))
      .get()
  if (preference) {
    db.update(f.table).set({ isPreferred: false }).where(eq(f.owner, source.id)).run()
  }
  for (const pair of duplicates.filter((p) => p.sourceWork === source.id)) {
    mergeFile(write, target, pair, pair.facts, source)
  }
  db.run(
    sql`update ${f.table} set ${sql.identifier(f.owner.name)}=${target.id} where ${f.owner}=${source.id}`,
  )
  for (const kind of f.parts) {
    const table = parts[kind].files
    db.update(table).set({ workId: target.id }).where(eq(table.workId, source.id)).run()
  }
}

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
  moveFileActivities(write, work.type, source.id, target.id)
  moveFileAnnotations(write, work.type, source.id, target.id)
  db.delete(schema.table).where(eq(schema.table.id, source.id)).run()
  const note = mergeText(target.note, source.note)
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
