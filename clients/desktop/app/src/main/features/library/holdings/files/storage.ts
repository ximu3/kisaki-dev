import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { and, count, eq, sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  FileWorkType,
  WorkRef,
  PartRef,
  FileCreateFields,
  FileAssociation,
  FileAssociationEdit,
  PreferredFileInput,
  FileQuery,
  HeldFile,
  AnimeFileMetadata,
  ReadingFileMetadata,
  FileAvailability,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import { ready } from '../../../../infrastructure/database/codecs/json'
import { searchText } from '../../../../infrastructure/database/search-text'
import { parts } from '../../parts/tables'
import { requirePart } from '../../parts/write'
import { requireEntry } from '../../entries/tables'
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
export function readFile(db: LibraryDatabase, work: FileWork, id: string): HeldFile {
  const row = fileRow(db, work, id),
    values = { ...row }
  Reflect.deleteProperty(values, work.type + 'Id')
  if (row.availability.status !== 'ready') {
    throw new DesktopError('DataIntegrityError', 'Invalid stored file availability')
  }
  const mode = row.associationMode
  const valid = mode === 'automatic' || mode === 'manual'
  return {
    ...values,
    work,
    kind: 'kind' in row ? row.kind : 'file',
    associations: directLinks(db, work, id),
    availability: row.availability.value,
    associationMode: valid ? mode : null,
    associationError: valid
      ? null
      : { code: 'DataIntegrityError', message: 'The saved association mode is invalid' },
  } as HeldFile
}
export function listFiles(
  db: LibraryDatabase,
  work: FileWork,
  query: FileQuery,
  range: ListOptions,
  directoryFiles: readonly string[] | null,
) {
  const { table, owner } = mediaFiles[work.type]
  const filters = [eq(owner, work.id)]
  if (directoryFiles) {
    filters.push(
      sql`${table.id} in(select value from json_each(${JSON.stringify(directoryFiles)}))`,
    )
  }
  if (query.part) {
    const part = requirePart(db, query.part)
    if (part.work.id !== work.id) {
      throw new DesktopError('InvalidReference', 'The part belongs to another work')
    }
    const links = parts[query.part.type].files
    filters.push(
      sql`exists(select 1 from ${links} where ${links.fileId}=${table.id} and ${links.partId}=${query.part.id})`,
    )
  }
  if (query.association) {
    const joins = mediaFiles[work.type].parts.map((kind) => {
      const links = parts[kind].files
      return sql`select 1 from ${links} where ${links.fileId}=${table.id}`
    })
    const associated = sql`exists(${sql.join(joins, sql` union all `)})`
    filters.push(query.association === 'associated' ? associated : sql`not ${associated}`)
  }
  if (query.associationMode) {
    filters.push(eq(table.associationMode, query.associationMode))
  }
  if (query.availability) {
    filters.push(sql`json_extract(${table.availability},'$.status')=${query.availability}`)
  }
  for (const word of searchText(query.search).trim().split(/\s+/u).filter(Boolean)) {
    filters.push(
      sql`(instr(library_text(${table.path}),${word}) or instr(library_text(${table.note}),${word}))`,
    )
  }
  const where = and(...filters)
  const rows = db
    .select({ id: table.id })
    .from(table)
    .where(where)
    .orderBy(sql`${table.path} collate kisaki_name`, table.id)
    .limit(range.limit)
    .offset(range.offset)
    .all()
  return {
    total: db.select({ n: count() }).from(table).where(where).get()!.n,
    items: rows.map((row) => readFile(db, work, row.id)),
  }
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
