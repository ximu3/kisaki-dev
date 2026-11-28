import { randomUUID } from 'node:crypto'
import { and, count, eq, sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  FileCreateFields,
  FileQuery,
  HeldFile,
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
import { type FileFacts, type FileWork, fileRow, fileChange, storeFileFacts } from './record'
import { directLinks, editAssociations, preferFile } from './associations'

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
