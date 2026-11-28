import { and, eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { EntryRef } from '@kisaki3/desktop-contracts/library'
import * as schema from '../../../infrastructure/database/schema'
import type { LibraryDatabase } from '../transaction'

export const catalogTables = {
  game: schema.games,
  anime: schema.animes,
  comic: schema.comics,
  novel: schema.novels,
  character: schema.characters,
  person: schema.persons,
  organization: schema.organizations,
}

export const recordTables = {
  game: schema.gameRecords,
  anime: schema.animeRecords,
  comic: schema.comicRecords,
  novel: schema.novelRecords,
}

export const activityTables = {
  game: { table: schema.gamePlayActivity, owner: schema.gamePlayActivity.gameId },
  anime: { table: schema.animeWatchActivity, owner: schema.animeWatchActivity.animeId },
  comic: { table: schema.comicReadingActivity, owner: schema.comicReadingActivity.comicId },
  novel: { table: schema.novelReadingActivity, owner: schema.novelReadingActivity.novelId },
}

export function entryWhere(ref: EntryRef) {
  return and(eq(schema.entries.id, ref.id), eq(schema.entries.type, ref.type))
}

export function requireEntry(db: LibraryDatabase, ref: EntryRef) {
  if (!db.select({ id: schema.entries.id }).from(schema.entries).where(entryWhere(ref)).get()) {
    throw new DesktopError('InvalidReference', 'The entry does not exist with the requested type')
  }
}
