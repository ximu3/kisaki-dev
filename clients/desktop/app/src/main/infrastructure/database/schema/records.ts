/** @fileoverview Stores independent evaluations, current work records, completion facts and actual activity intervals. */

import { desc, sql } from 'drizzle-orm'
import { primaryKey, check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { parseActivityContextNames } from '@kisaki3/desktop-contracts/library'
import { calendarDate } from '../codecs/catalog'
import { storedJsonColumn } from '../codecs/json'
import {
  entries,
  games,
  animes,
  comics,
  novels,
  animeEpisodes,
  animeExtras,
  comicVolumes,
  comicChapters,
  novelVolumes,
} from './catalog'
import { animeFiles, comicFiles, novelFiles, gameLaunchConfigs } from './holdings'
import { booleanValue, enumValue, idColumn, safeInteger, timestamps } from './constraints'

/** Stores nullable personal ratings and explicit favorite state for all seven entry types. */
export const entryEvaluations = sqliteTable(
  'entry_evaluations',
  {
    entryId: idColumn('entry_id').references(() => entries.id, { onDelete: 'cascade' }),
    rating: integer('rating'),
    favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.entryId] }),
    safeInteger('entry_evaluations_rating', table.rating, 0, 100),
    booleanValue('entry_evaluations_favorite', table.favorite),
    index('entry_evaluations_rated').on(table.rating, table.entryId),
    index('entry_evaluations_favorites').on(table.favorite, table.entryId),
  ],
)

/** Creates a work-specific optional current record, separate from all history. */
function workRecord<TName extends string>(name: TName, ownerName: string, owner: AnySQLiteColumn) {
  return sqliteTable(
    name,
    {
      workId: idColumn(ownerName).references(() => owner, { onDelete: 'cascade' }),
      status: text('status', { enum: ['planned', 'active', 'onHold'] }),
      additionalDurationMs: integer('additional_duration_ms').notNull().default(0),
    },
    (table) => [
      primaryKey({ columns: [table.workId] }),
      enumValue(`${name}_status`, table.status, ['planned', 'active', 'onHold']),
      safeInteger(`${name}_duration`, table.additionalDurationMs),
      index(`${name}_status_order`).on(table.status, table.workId),
    ],
  )
}

/** Stores a game's current personal status and additional duration separately from history. */
export const gameRecords = workRecord('game_records', 'game_id', games.entryId)

/** Stores an anime's current personal status and additional duration separately from history. */
export const animeRecords = workRecord('anime_records', 'anime_id', animes.entryId)

/** Stores a comic's current personal status and additional duration separately from history. */
export const comicRecords = workRecord('comic_records', 'comic_id', comics.entryId)

/** Stores a novel's current personal status and additional duration separately from history. */
export const novelRecords = workRecord('novel_records', 'novel_id', novels.entryId)

/** Creates a part's optional boolean completion mark, without dates or completion counts. */
function partRecord<TName extends string>(name: TName, ownerName: string, owner: AnySQLiteColumn) {
  return sqliteTable(
    name,
    {
      partId: idColumn(ownerName).references(() => owner, { onDelete: 'cascade' }),
      isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
    },
    (table) => [
      primaryKey({ columns: [table.partId] }),
      booleanValue(`${name}_completed`, table.isCompleted),
    ],
  )
}

/** Stores an optional completion mark for one actual episode. */
export const animeEpisodeRecords = partRecord(
  'anime_episode_records',
  'episode_id',
  animeEpisodes.id,
)

/** Stores an optional completion mark for one actual anime extra. */
export const animeExtraRecords = partRecord('anime_extra_records', 'extra_id', animeExtras.id)

/** Stores an optional completion mark for one actual comic volume. */
export const comicVolumeRecords = partRecord('comic_volume_records', 'volume_id', comicVolumes.id)

/** Stores an optional completion mark for one actual comic chapter. */
export const comicChapterRecords = partRecord(
  'comic_chapter_records',
  'chapter_id',
  comicChapters.id,
)

/** Stores an optional completion mark for one actual novel volume. */
export const novelVolumeRecords = partRecord('novel_volume_records', 'volume_id', novelVolumes.id)

/**
 * Stores individual completion facts; the writing operation verifies the referenced entry's
 * concrete work type.
 */
export const workCompletionRecords = sqliteTable(
  'work_completion_records',
  {
    id: idColumn(),
    workId: text('work_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    completedDate: calendarDate('completed_date'),
    note: text('note'),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('work_completion_records_work_created').on(table.workId, table.createdAt, table.id),
    index('work_completion_records_date').on(
      sql`json_extract(${table.completedDate}, '$.year')`,
      sql`json_extract(${table.completedDate}, '$.month')`,
      sql`json_extract(${table.completedDate}, '$.day')`,
      table.workId,
    ),
    index('work_completion_records_work_date').on(
      table.workId,
      sql`json_extract(${table.completedDate}, '$.year') desc`,
      sql`json_extract(${table.completedDate}, '$.month') desc`,
      sql`json_extract(${table.completedDate}, '$.day') desc`,
      table.id,
    ),
  ],
)

/** Creates occurrence facts and independently retained context names. */
function activityFields() {
  return {
    id: idColumn(),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at').notNull(),
    durationMs: integer('duration_ms').notNull(),
    contextNames: storedJsonColumn(parseActivityContextNames)('context_names').notNull(),
  }
}

/** Validates actual time intervals and indexes both work history and time-range reads. */
function activityConstraints(
  name: string,
  owner: AnySQLiteColumn,
  table: {
    id: AnySQLiteColumn
    startedAt: AnySQLiteColumn
    endedAt: AnySQLiteColumn
    durationMs: AnySQLiteColumn
  },
) {
  return [
    safeInteger(`${name}_start`, table.startedAt, Number.MIN_SAFE_INTEGER),
    safeInteger(`${name}_end`, table.endedAt, Number.MIN_SAFE_INTEGER),
    safeInteger(`${name}_duration`, table.durationMs),
    check(
      `${name}_interval`,
      sql`${table.endedAt} > ${table.startedAt} and ${table.durationMs} <= ${table.endedAt} - ${table.startedAt}`,
    ),
    index(`${name}_work_time`).on(
      owner,
      desc(table.startedAt),
      table.id,
      table.durationMs,
      table.endedAt,
    ),
    index(`${name}_time`).on(table.startedAt, table.endedAt, owner),
  ]
}

/**
 * Stores actual game-use intervals with occurrence names retained after launch-configuration
 * removal.
 */
export const gamePlayActivity = sqliteTable(
  'game_play_activity',
  {
    ...activityFields(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.entryId, { onDelete: 'cascade' }),
    launchConfigId: text('launch_config_id').references(() => gameLaunchConfigs.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    ...activityConstraints('game_play_activity', table.gameId, table),
    index('game_play_activity_config').on(table.launchConfigId),
  ],
)

/**
 * Stores actual watch intervals with optional file and part references and independent occurrence
 * names.
 */
export const animeWatchActivity = sqliteTable(
  'anime_watch_activity',
  {
    ...activityFields(),
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.entryId, { onDelete: 'cascade' }),
    fileId: text('file_id').references(() => animeFiles.id, { onDelete: 'set null' }),
    episodeId: text('episode_id').references(() => animeEpisodes.id, { onDelete: 'set null' }),
    extraId: text('extra_id').references(() => animeExtras.id, { onDelete: 'set null' }),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    ...activityConstraints('anime_watch_activity', table.animeId, table),
    check('anime_watch_activity_part', sql`${table.episodeId} is null or ${table.extraId} is null`),
    index('anime_watch_activity_file').on(table.fileId),
    index('anime_watch_activity_episode').on(table.episodeId),
    index('anime_watch_activity_extra').on(table.extraId),
  ],
)

/**
 * Stores actual comic-reading intervals without multiplying a compound file's time across its
 * parts.
 */
export const comicReadingActivity = sqliteTable(
  'comic_reading_activity',
  {
    ...activityFields(),
    comicId: text('comic_id')
      .notNull()
      .references(() => comics.entryId, { onDelete: 'cascade' }),
    fileId: text('file_id').references(() => comicFiles.id, { onDelete: 'set null' }),
    volumeId: text('volume_id').references(() => comicVolumes.id, { onDelete: 'set null' }),
    chapterId: text('chapter_id').references(() => comicChapters.id, { onDelete: 'set null' }),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    ...activityConstraints('comic_reading_activity', table.comicId, table),
    check(
      'comic_reading_activity_part',
      sql`${table.volumeId} is null or ${table.chapterId} is null`,
    ),
    index('comic_reading_activity_file').on(table.fileId),
    index('comic_reading_activity_volume').on(table.volumeId),
    index('comic_reading_activity_chapter').on(table.chapterId),
  ],
)

/** Stores actual novel-reading intervals with optional file and volume context. */
export const novelReadingActivity = sqliteTable(
  'novel_reading_activity',
  {
    ...activityFields(),
    novelId: text('novel_id')
      .notNull()
      .references(() => novels.entryId, { onDelete: 'cascade' }),
    fileId: text('file_id').references(() => novelFiles.id, { onDelete: 'set null' }),
    volumeId: text('volume_id').references(() => novelVolumes.id, { onDelete: 'set null' }),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    ...activityConstraints('novel_reading_activity', table.novelId, table),
    index('novel_reading_activity_file').on(table.fileId),
    index('novel_reading_activity_volume').on(table.volumeId),
  ],
)
