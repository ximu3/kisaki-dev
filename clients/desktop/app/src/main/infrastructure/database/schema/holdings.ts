import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core'
import {
  parseGameLaunchDefinition,
  parseDirectoryDiscoveryDefinition,
  parseFileRecognitionDefinitionShape,
  parseFilePlaybackChoices,
  parseReadingPosition,
} from '@kisaki3/desktop-contracts/library'
import { storedJsonColumn, jsonLiteral } from '../codecs/json'
import {
  parseAnimeMetadata,
  parseReadingMetadata,
  parseFileAvailability,
  parsePlaybackPosition,
  parsePlaybackOverride,
  parseReadingOverride,
} from '../codecs/holdings'
import {
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
import {
  booleanValue,
  enumValue,
  idColumn,
  safeInteger,
  timestamps,
  workForeignKey,
} from './constraints'

function recognitionProfiles<TName extends string>(
  name: TName,
  medium: 'anime' | 'comic' | 'novel',
) {
  return sqliteTable(
    name,
    {
      id: idColumn(),
      name: text('name').notNull(),
      description: text('description'),
      definition: storedJsonColumn((value) => parseFileRecognitionDefinitionShape(medium, value))(
        'definition',
      ).notNull(),
      sortOrder: integer('sort_order').notNull().default(0),
      ...timestamps(),
    },
    (table) => [
      primaryKey({ columns: [table.id] }),
      safeInteger(`${name}_order`, table.sortOrder),
      index(`${name}_ordered`).on(table.sortOrder, table.id),
    ],
  )
}

export const animeFileRecognitionProfiles = recognitionProfiles(
  'anime_file_recognition_profiles',
  'anime',
)

export const comicFileRecognitionProfiles = recognitionProfiles(
  'comic_file_recognition_profiles',
  'comic',
)

export const novelFileRecognitionProfiles = recognitionProfiles(
  'novel_file_recognition_profiles',
  'novel',
)

function directoryFields() {
  return { id: idColumn(), path: text('path').notNull(), ...timestamps() }
}

export const gameDirectories = sqliteTable(
  'game_directories',
  {
    ...directoryFields(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.entryId, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    unique('game_directories_path').on(table.gameId, table.path),
  ],
)

export const animeDirectories = sqliteTable(
  'anime_directories',
  {
    ...directoryFields(),
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.entryId, { onDelete: 'cascade' }),
    definition: storedJsonColumn(parseDirectoryDiscoveryDefinition)('definition').notNull(),
    recognitionProfileId: text('recognition_profile_id').references(
      () => animeFileRecognitionProfiles.id,
      { onDelete: 'restrict' },
    ),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    unique('anime_directories_path').on(table.animeId, table.path),
    index('anime_directories_profile').on(table.recognitionProfileId),
  ],
)

export const comicDirectories = sqliteTable(
  'comic_directories',
  {
    ...directoryFields(),
    comicId: text('comic_id')
      .notNull()
      .references(() => comics.entryId, { onDelete: 'cascade' }),
    definition: storedJsonColumn(parseDirectoryDiscoveryDefinition)('definition').notNull(),
    recognitionProfileId: text('recognition_profile_id').references(
      () => comicFileRecognitionProfiles.id,
      { onDelete: 'restrict' },
    ),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    unique('comic_directories_path').on(table.comicId, table.path),
    index('comic_directories_profile').on(table.recognitionProfileId),
  ],
)

export const novelDirectories = sqliteTable(
  'novel_directories',
  {
    ...directoryFields(),
    novelId: text('novel_id')
      .notNull()
      .references(() => novels.entryId, { onDelete: 'cascade' }),
    definition: storedJsonColumn(parseDirectoryDiscoveryDefinition)('definition').notNull(),
    recognitionProfileId: text('recognition_profile_id').references(
      () => novelFileRecognitionProfiles.id,
      { onDelete: 'restrict' },
    ),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    unique('novel_directories_path').on(table.novelId, table.path),
    index('novel_directories_profile').on(table.recognitionProfileId),
  ],
)

export const gameLaunchConfigs = sqliteTable(
  'game_launch_configs',
  {
    id: idColumn(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.entryId, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    note: text('note'),
    definition: storedJsonColumn(parseGameLaunchDefinition)('definition').notNull(),
    isPreferred: integer('is_preferred', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    unique('game_launch_configs_id_work').on(table.id, table.gameId),
    booleanValue('game_launch_configs_preferred_value', table.isPreferred),
    safeInteger('game_launch_configs_order', table.sortOrder),
    uniqueIndex('game_launch_configs_preferred')
      .on(table.gameId)
      .where(sql`${table.isPreferred} = 1`),
    index('game_launch_configs_ordered').on(table.gameId, table.sortOrder, table.id),
  ],
)

const associationModes = ['automatic', 'manual'] as const
const readingFileKinds = ['file', 'directory'] as const

function fileFields() {
  return {
    id: idColumn(),
    path: text('path').notNull(),
    note: text('note'),
    associationMode: text('association_mode', { enum: associationModes })
      .notNull()
      .default('automatic'),
    isPreferred: integer('is_preferred', { mode: 'boolean' }).notNull().default(false),
    availability: storedJsonColumn(parseFileAvailability)('availability')
      .notNull()
      .default(jsonLiteral({ status: 'unchecked' })),
    ...timestamps(),
  }
}

function readingFileFields() {
  return {
    kind: text('kind', { enum: readingFileKinds }).notNull(),
    metadata: storedJsonColumn(parseReadingMetadata)('metadata'),
    position: storedJsonColumn(parseReadingPosition)('position'),
    progress: real('progress'),
    textEncoding: text('text_encoding'),
    preferences: storedJsonColumn(parseReadingOverride)('preferences'),
  }
}

function fileConstraints(
  name: string,
  owner: AnySQLiteColumn,
  table: {
    id: AnySQLiteColumn
    path: AnySQLiteColumn
    isPreferred: AnySQLiteColumn
    associationMode: AnySQLiteColumn
  },
) {
  return [
    unique(`${name}_id_work`).on(table.id, owner),
    unique(`${name}_path`).on(owner, table.path),
    booleanValue(`${name}_preferred_value`, table.isPreferred),
    enumValue(`${name}_association_mode`, table.associationMode, associationModes),
    uniqueIndex(`${name}_preferred`)
      .on(owner)
      .where(sql`${table.isPreferred} = 1`),
  ]
}

export const animeFiles = sqliteTable(
  'anime_files',
  {
    ...fileFields(),
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.entryId, { onDelete: 'cascade' }),
    metadata: storedJsonColumn(parseAnimeMetadata)('metadata'),
    position: storedJsonColumn(parsePlaybackPosition)('position'),
    preferences: storedJsonColumn(parsePlaybackOverride)('preferences'),
    playbackChoices: storedJsonColumn(parseFilePlaybackChoices)('playback_choices')
      .notNull()
      .default(
        jsonLiteral({
          audioTrack: null,
          subtitleTrack: null,
          audioDelaySeconds: 0,
          subtitleDelaySeconds: 0,
        }),
      ),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    ...fileConstraints('anime_files', table.animeId, table),
  ],
)

export const comicFiles = sqliteTable(
  'comic_files',
  {
    ...fileFields(),
    comicId: text('comic_id')
      .notNull()
      .references(() => comics.entryId, { onDelete: 'cascade' }),
    ...readingFileFields(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    ...fileConstraints('comic_files', table.comicId, table),
    enumValue('comic_files_kind', table.kind, readingFileKinds),
    check('comic_files_progress', sql`${table.progress} between 0 and 1`),
  ],
)

export const novelFiles = sqliteTable(
  'novel_files',
  {
    ...fileFields(),
    novelId: text('novel_id')
      .notNull()
      .references(() => novels.entryId, { onDelete: 'cascade' }),
    ...readingFileFields(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    ...fileConstraints('novel_files', table.novelId, table),
    enumValue('novel_files_kind', table.kind, readingFileKinds),
    check('novel_files_progress', sql`${table.progress} between 0 and 1`),
  ],
)

function fileParts<TName extends string>(
  name: TName,
  partName: string,
  file: { id: AnySQLiteColumn; work: AnySQLiteColumn },
  part: { id: AnySQLiteColumn; work: AnySQLiteColumn },
) {
  return sqliteTable(
    name,
    {
      workId: idColumn(file.work.name),
      fileId: idColumn('file_id'),
      partId: idColumn(partName),
      isPreferred: integer('is_preferred', { mode: 'boolean' }).notNull().default(false),
    },
    (table) => [
      primaryKey({ columns: [table.fileId, table.partId] }),
      workForeignKey(table.fileId, table.workId, file.id, file.work).onDelete('cascade'),
      workForeignKey(table.partId, table.workId, part.id, part.work).onDelete('cascade'),
      booleanValue(`${name}_preferred_value`, table.isPreferred),
      uniqueIndex(`${name}_preferred`)
        .on(table.partId)
        .where(sql`${table.isPreferred} = 1`),
      index(`${name}_part`).on(table.partId, table.fileId),
    ],
  )
}

export const animeFileEpisodes = fileParts(
  'anime_file_episodes',
  'episode_id',
  { id: animeFiles.id, work: animeFiles.animeId },
  { id: animeEpisodes.id, work: animeEpisodes.animeId },
)

export const animeFileExtras = fileParts(
  'anime_file_extras',
  'extra_id',
  { id: animeFiles.id, work: animeFiles.animeId },
  { id: animeExtras.id, work: animeExtras.animeId },
)

export const comicFileVolumes = fileParts(
  'comic_file_volumes',
  'volume_id',
  { id: comicFiles.id, work: comicFiles.comicId },
  { id: comicVolumes.id, work: comicVolumes.comicId },
)

export const comicFileChapters = fileParts(
  'comic_file_chapters',
  'chapter_id',
  { id: comicFiles.id, work: comicFiles.comicId },
  { id: comicChapters.id, work: comicChapters.comicId },
)

export const novelFileVolumes = fileParts(
  'novel_file_volumes',
  'volume_id',
  { id: novelFiles.id, work: novelFiles.novelId },
  { id: novelVolumes.id, work: novelVolumes.novelId },
)

function usagePreferences<TName extends string, T>(
  name: TName,
  ownerName: string,
  owner: AnySQLiteColumn,
  parse: (input: unknown) => T,
) {
  return sqliteTable(
    name,
    {
      ownerId: idColumn(ownerName).references(() => owner, { onDelete: 'cascade' }),
      settings: storedJsonColumn(parse)('settings').notNull(),
    },
    (table) => [primaryKey({ columns: [table.ownerId] })],
  )
}

export const animePlaybackPreferences = usagePreferences(
  'anime_playback_preferences',
  'anime_id',
  animes.entryId,
  parsePlaybackOverride,
)

export const comicReadingPreferences = usagePreferences(
  'comic_reading_preferences',
  'comic_id',
  comics.entryId,
  parseReadingOverride,
)

export const novelReadingPreferences = usagePreferences(
  'novel_reading_preferences',
  'novel_id',
  novels.entryId,
  parseReadingOverride,
)
