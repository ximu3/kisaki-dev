import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { FileQuery, HeldFile } from '@kisaki3/desktop-contracts/library'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import { and, count, eq, sql } from 'drizzle-orm'
import { searchText } from '../../../../infrastructure/database/search-text'
import { parts } from '../../parts/tables'
import { requirePart } from '../../parts/write'
import type { LibraryDatabase } from '../../transaction'
import { directLinks } from './associations'
import { type FileWork, fileRow } from './record'
import { mediaFiles } from './tables'

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
