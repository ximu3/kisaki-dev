/** @fileoverview Stores independent notes and four content-annotation families while retaining history after file removal. */

import { desc } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import {
  parsePlaybackAnnotationLocation,
  parseReadingAnnotationLocation,
} from '@kisaki3/desktop-contracts/library'
import { storedJsonColumn } from '../codecs/json'
import { attachments } from './attachments/metadata'
import { entries, games, animes, comics, novels } from './catalog'
import { animeFiles, comicFiles, novelFiles } from './holdings'
import { idColumn, safeInteger, timestamps } from './constraints'

/** Stores independently identified Markdown notes whose lifetime is separate from entry links. */
export const notes = sqliteTable(
  'notes',
  {
    id: idColumn(),
    title: text('title'),
    content: text('content').notNull().default(''),
    primaryImageId: text('primary_image_id').references(() => attachments.id, {
      onDelete: 'restrict',
    }),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('notes_updated').on(desc(table.updatedAt), table.id),
    index('notes_primary_image').on(table.primaryImageId),
  ],
)

/** Associates notes and entries with independent order on each side. */
export const noteEntryLinks = sqliteTable(
  'note_entry_links',
  {
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    entryId: text('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    orderInNote: integer('order_in_note').notNull().default(0),
    orderInEntry: integer('order_in_entry').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.noteId, table.entryId] }),
    safeInteger('note_entry_links_note_order', table.orderInNote),
    safeInteger('note_entry_links_entry_order', table.orderInEntry),
    index('note_entry_links_note').on(table.noteId, table.orderInNote, table.entryId),
    index('note_entry_links_entry').on(table.entryId, table.orderInEntry, table.noteId),
  ],
)

/** Creates the independently stored content fields shared by the four annotation tables. */
function annotationFields() {
  return {
    id: idColumn(),
    title: text('title'),
    content: text('content').notNull().default(''),
    ...timestamps(),
  }
}

/** Indexes chronological annotation reads and the owner's image reference. */
function annotationIndexes(
  name: string,
  owner: AnySQLiteColumn,
  table: { id: AnySQLiteColumn; imageId: AnySQLiteColumn; createdAt: AnySQLiteColumn },
) {
  return [
    index(`${name}_created`).on(desc(table.createdAt), table.id),
    index(`${name}_work_created`).on(owner, desc(table.createdAt), table.id),
    index(`${name}_image`).on(table.imageId),
  ]
}

/** Stores game-owned screenshot annotations and their separately referenced image bytes. */
export const gameAnnotations = sqliteTable(
  'game_annotations',
  {
    ...annotationFields(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.entryId, { onDelete: 'cascade' }),
    imageId: text('image_id')
      .notNull()
      .references(() => attachments.id, { onDelete: 'restrict' }),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    ...annotationIndexes('game_annotations', table.gameId, table),
  ],
)

/**
 * Stores video annotations whose saved content and location survive removal of the registered
 * file.
 */
export const animeAnnotations = sqliteTable(
  'anime_annotations',
  {
    ...annotationFields(),
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.entryId, { onDelete: 'cascade' }),
    fileId: text('file_id').references(() => animeFiles.id, { onDelete: 'set null' }),
    imageId: text('image_id').references(() => attachments.id, { onDelete: 'restrict' }),
    location: storedJsonColumn(parsePlaybackAnnotationLocation)('location').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    ...annotationIndexes('anime_annotations', table.animeId, table),
    index('anime_annotations_file').on(table.fileId, table.createdAt, table.id),
  ],
)

/** Stores comic annotations with source locations and optional quotes that survive file removal. */
export const comicAnnotations = sqliteTable(
  'comic_annotations',
  {
    ...annotationFields(),
    comicId: text('comic_id')
      .notNull()
      .references(() => comics.entryId, { onDelete: 'cascade' }),
    fileId: text('file_id').references(() => comicFiles.id, { onDelete: 'set null' }),
    imageId: text('image_id').references(() => attachments.id, { onDelete: 'restrict' }),
    location: storedJsonColumn(parseReadingAnnotationLocation)('location').notNull(),
    quote: text('quote'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    ...annotationIndexes('comic_annotations', table.comicId, table),
    index('comic_annotations_file').on(table.fileId, table.createdAt, table.id),
  ],
)

/** Stores novel annotations with source locations and optional quotes that survive file removal. */
export const novelAnnotations = sqliteTable(
  'novel_annotations',
  {
    ...annotationFields(),
    novelId: text('novel_id')
      .notNull()
      .references(() => novels.entryId, { onDelete: 'cascade' }),
    fileId: text('file_id').references(() => novelFiles.id, { onDelete: 'set null' }),
    imageId: text('image_id').references(() => attachments.id, { onDelete: 'restrict' }),
    location: storedJsonColumn(parseReadingAnnotationLocation)('location').notNull(),
    quote: text('quote'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    ...annotationIndexes('novel_annotations', table.novelId, table),
    index('novel_annotations_file').on(table.fileId, table.createdAt, table.id),
  ],
)
