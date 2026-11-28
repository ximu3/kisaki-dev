import { isDeepStrictEqual } from 'node:util'
import { and, eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  PartRef,
  FileAssociation,
  FileAssociationEdit,
  PreferredFileInput,
} from '@kisaki3/desktop-contracts/library'
import { parts } from '../../parts/tables'
import { requirePart } from '../../parts/write'
import type { LibraryDatabase, LibraryWrite } from '../../transaction'
import { mediaFiles } from '../tables'
import { type FileWork, fileChange, fileRow } from './record'

export function directLinks(db: LibraryDatabase, work: FileWork, id: string): FileAssociation[] {
  return mediaFiles[work.type].parts.flatMap((kind) => {
    const table = parts[kind].files
    return db
      .select({ id: table.partId, isPreferred: table.isPreferred })
      .from(table)
      .where(and(eq(table.workId, work.id), eq(table.fileId, id)))
      .orderBy(table.partId)
      .all()
      .map((row) => ({ part: { type: kind, id: row.id }, isPreferred: row.isPreferred }))
  })
}

export function preferFile(write: LibraryWrite, work: FileWork, input: PreferredFileInput) {
  const { table: files, owner } = mediaFiles[work.type]
  if (input.fileId) {
    fileRow(write.db, work, input.fileId)
  }
  let old: string | null = null
  if (input.scope.type === 'work') {
    old =
      write.db
        .select({ id: files.id })
        .from(files)
        .where(and(eq(owner, work.id), eq(files.isPreferred, true)))
        .get()?.id ?? null
    if (input.expected && input.expected.preferredFileId !== old) {
      throw new DesktopError('Conflict', 'The preferred file changed')
    }
    if (old === input.fileId) {
      return
    }
    if (old) {
      write.db
        .update(files)
        .set({ isPreferred: false, updatedAt: write.now })
        .where(eq(files.id, old))
        .run()
    }
    if (input.fileId) {
      write.db
        .update(files)
        .set({ isPreferred: true, updatedAt: write.now })
        .where(eq(files.id, input.fileId))
        .run()
    }
  } else {
    const part = requirePart(write.db, input.scope.part)
    if (part.work.id !== work.id) {
      throw new DesktopError('InvalidReference', 'The part belongs to another work')
    }
    const links = parts[part.ref.type].files,
      where = eq(links.partId, part.ref.id)
    old =
      write.db
        .select({ id: links.fileId })
        .from(links)
        .where(and(where, eq(links.isPreferred, true)))
        .get()?.id ?? null
    if (input.expected && old !== input.expected.preferredFileId) {
      throw new DesktopError('Conflict', 'The preferred part file changed')
    }
    if (old === input.fileId) {
      return
    }
    if (old) {
      write.db
        .update(links)
        .set({ isPreferred: false })
        .where(and(where, eq(links.fileId, old)))
        .run()
    }
    if (
      input.fileId &&
      !write.db
        .update(links)
        .set({ isPreferred: true })
        .where(and(where, eq(links.fileId, input.fileId)))
        .run().changes
    ) {
      throw new DesktopError('InvalidReference', 'The file is not associated with this part')
    }
  }
  fileChange(
    write,
    work,
    [old, input.fileId].filter((value): value is string => value !== null),
  )
}

export function editAssociations(
  write: LibraryWrite,
  work: FileWork,
  id: string,
  input: FileAssociationEdit,
  manual: boolean,
  admitted = true,
) {
  const { db } = write
  const old = fileRow(db, work, id),
    before = directLinks(db, work, id)
  if (
    input.expected &&
    (input.expected.associationMode !== old.associationMode ||
      !isDeepStrictEqual(new Set(before), new Set(input.expected.associations)))
  ) {
    throw new DesktopError('Conflict', 'The saved file associations changed')
  }
  const change = input.change
  const add = change.type === 'replace' ? change.items : (change.add ?? [])
  const remove = change.type === 'replace' ? [] : (change.remove ?? [])
  for (const part of [...add.map((item) => item.part), ...remove]) {
    if (requirePart(db, part).work.id !== work.id) {
      throw new DesktopError('InvalidReference', 'Select parts of the same work')
    }
  }
  const key = (ref: PartRef) => ref.type + ':' + ref.id
  const keep = new Map((change.type === 'replace' ? [] : before).map((row) => [key(row.part), row]))
  for (const ref of remove) {
    keep.delete(key(ref))
  }
  for (const link of add) {
    if (!keep.has(key(link.part))) {
      keep.set(key(link.part), {
        part: link.part,
        isPreferred:
          link.isPreferred ??
          (manual
            ? false
            : (before.find((row) => key(row.part) === key(link.part))?.isPreferred ?? false)),
      })
    }
  }
  if (
    !admitted &&
    (before.length !== keep.size || before.some((link) => !keep.has(key(link.part))))
  ) {
    return false
  }
  for (const row of before) {
    if (!keep.has(key(row.part))) {
      const table = parts[row.part.type].files
      db.delete(table)
        .where(and(eq(table.fileId, id), eq(table.partId, row.part.id)))
        .run()
    }
  }
  for (const link of keep.values()) {
    if (before.some((row) => isDeepStrictEqual(row, link))) {
      continue
    }
    const table = parts[link.part.type].files
    db.insert(table)
      .values({ workId: work.id, fileId: id, partId: link.part.id, isPreferred: false })
      .onConflictDoNothing()
      .run()
    if (link.isPreferred) {
      preferFile(write, work, { scope: { type: 'part', part: link.part }, fileId: id })
    } else {
      db.update(table)
        .set({ isPreferred: false })
        .where(and(eq(table.fileId, id), eq(table.partId, link.part.id)))
        .run()
    }
  }
  const mode = manual ? 'manual' : old.associationMode
  if (mode !== old.associationMode || !isDeepStrictEqual(new Set(before), new Set(keep.values()))) {
    const table = mediaFiles[work.type].table
    db.update(table)
      .set({ associationMode: mode, updatedAt: write.now })
      .where(eq(table.id, id))
      .run()
    fileChange(write, work, [id])
  }
  return true
}
