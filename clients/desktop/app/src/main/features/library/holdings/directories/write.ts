import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  DirectoryCreateFields,
  DirectoryUpdate,
  WorkRef,
} from '@kisaki3/desktop-contracts/library'
import { and, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { ready } from '../../../../infrastructure/database/codecs/json'
import { requireEntry } from '../../entries/tables'
import { expectFields, type LibraryDatabase, type LibraryWrite } from '../../transaction'
import { profiles } from '../recognition/profiles/storage'
import { defaultDiscovery, directories } from './tables'

export function moveDirectories(write: LibraryWrite, source: WorkRef, target: WorkRef) {
  const { db } = write
  const dir = directories[target.type]
  db.run(
    sql`update ${dir.table} set ${sql.identifier(dir.owner.name)}=${target.id} where ${dir.owner}=${source.id}`,
  )
}

export function requireProfile(
  db: LibraryDatabase,
  type: keyof typeof profiles,
  id: string | null | undefined,
) {
  if (!id) {
    return
  }
  const table = profiles[type]
  if (!db.select({ id: table.id }).from(table).where(eq(table.id, id)).get()) {
    throw new DesktopError('InvalidReference', 'Choose a recognition profile for this kind of work')
  }
}

export function addDirectory(write: LibraryWrite, work: WorkRef, input: DirectoryCreateFields) {
  requireEntry(write.db, work)
  const id = randomUUID(),
    base = { id, path: input.path, createdAt: write.now, updatedAt: write.now }
  if (work.type === 'game') {
    write.db
      .insert(directories.game.table)
      .values({ ...base, gameId: work.id })
      .run()
  } else {
    const definition = ready(
      'definition' in input && input.definition ? input.definition : defaultDiscovery,
    )
    const recognitionProfileId =
      'recognitionProfileId' in input ? (input.recognitionProfileId ?? null) : null
    requireProfile(write.db, work.type, recognitionProfileId)
    if (work.type === 'anime') {
      write.db
        .insert(directories.anime.table)
        .values({ ...base, animeId: work.id, definition, recognitionProfileId })
        .run()
    }
    if (work.type === 'comic') {
      write.db
        .insert(directories.comic.table)
        .values({ ...base, comicId: work.id, definition, recognitionProfileId })
        .run()
    }
    if (work.type === 'novel') {
      write.db
        .insert(directories.novel.table)
        .values({ ...base, novelId: work.id, definition, recognitionProfileId })
        .run()
    }
  }
  write.changes.push({ type: 'holdingsChanged', work, directoryIds: [id] } as Extract<
    LibraryWrite['changes'][number],
    { type: 'holdingsChanged' }
  >)
  return id
}

export function editDirectory(
  write: LibraryWrite,
  work: WorkRef,
  id: string,
  input: DirectoryUpdate,
) {
  if (work.type === 'game') {
    throw new DesktopError('InvalidInput', 'A game directory has no discovery rules')
  }
  const { table, owner } = directories[work.type],
    where = and(eq(owner, work.id), eq(table.id, id))
  const row = write.db.select().from(table).where(where).get()
  if (!row) {
    throw new DesktopError('NotFound', 'The directory no longer exists')
  }
  const before = {
    definition: row.definition.status === 'ready' ? row.definition.value : undefined,
    recognitionProfileId: row.recognitionProfileId,
  }
  expectFields(before, input.expected)
  const { definition, recognitionProfileId } = input.changes
  if (
    Object.entries(input.changes).every(([key, value]) =>
      isDeepStrictEqual(value, Reflect.get(before, key)),
    )
  ) {
    return
  }
  requireProfile(write.db, work.type, recognitionProfileId)
  write.db
    .update(table)
    .set({
      ...(definition && { definition: ready(definition) }),
      ...(recognitionProfileId !== undefined && { recognitionProfileId }),
      updatedAt: write.now,
    })
    .where(where)
    .run()
  write.changes.push({
    type: 'holdingsChanged',
    work: { type: work.type, id: work.id },
    directoryIds: [id],
  } as Extract<LibraryWrite['changes'][number], { type: 'holdingsChanged' }>)
}
