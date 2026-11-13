/** @fileoverview Defines the seven entry tables, exact external identities and five real part tables. */

import { desc, sql } from 'drizzle-orm'
import {
  blob,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { entryTypes } from '@kisaki3/desktop-contracts/library'
import type { EntryType } from '@kisaki3/desktop-contracts/library'
import { aliases, externalLinks, languages, partialDate, characterMeasure } from '../codecs/catalog'
import { attachments } from './attachments'
import { booleanValue, enumValue, nonempty, idColumn, safeInteger, timestamps } from './constraints'

export const entries = sqliteTable(
  'entries',
  {
    id: idColumn(),
    type: text('type', { enum: entryTypes }).notNull(),
    name: text('name').notNull(),
    originalName: text('original_name'),
    sortName: text('sort_name'),
    aliases: aliases('aliases').notNull().default([]),
    description: text('description'),
    primaryImageId: text('primary_image_id').references(() => attachments.id, {
      onDelete: 'restrict',
    }),
    externalLinks: externalLinks('external_links').notNull().default([]),
    isNsfw: integer('is_nsfw', { mode: 'boolean' }).notNull().default(false),
    addedDate: partialDate('added_date'),
    ...timestamps(),

    nameKey: blob('name_key', { mode: 'buffer' }).generatedAlwaysAs(
      sql`kisaki_name_key_v1("name")`,
      { mode: 'stored' },
    ),
    sortNameKey: blob('sort_name_key', { mode: 'buffer' }).generatedAlwaysAs(
      sql`kisaki_name_key_v1(coalesce("sort_name", "name"))`,
      { mode: 'stored' },
    ),
    originalNameKey: blob('original_name_key', { mode: 'buffer' }).generatedAlwaysAs(
      sql`kisaki_name_key_v1("original_name")`,
      { mode: 'stored' },
    ),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    unique('entries_id_type').on(table.id, table.type),
    enumValue('entries_type', table.type, entryTypes),
    nonempty('entries_id', table.id),
    nonempty('entries_name', table.name),
    booleanValue('entries_nsfw', table.isNsfw),
    safeInteger('entries_created', table.createdAt, Number.MIN_SAFE_INTEGER),
    safeInteger('entries_updated', table.updatedAt, Number.MIN_SAFE_INTEGER),
    index('entries_type_sort').on(table.type, table.sortNameKey, table.id),
    index('entries_sort').on(table.sortNameKey, table.id),
    index('entries_name').on(table.nameKey, table.id),
    index('entries_original_name').on(table.originalNameKey, table.id),
    index('entries_created_order').on(desc(table.createdAt), table.id),
    index('entries_primary_image').on(table.primaryImageId),
  ],
)

/** Creates the fixed type discriminator used by each concrete entry table. */
function entryIdentity(type: EntryType) {
  return {
    entryId: idColumn('entry_id'),
    entryType: text('entry_type').generatedAlwaysAs(sql.raw(`'${type}'`)),
  }
}

/** Constrains a concrete row to the matching type of its shared entry identity. */
function entryForeignKey(entryId: AnySQLiteColumn, entryType: AnySQLiteColumn) {
  return foreignKey({
    columns: [entryId, entryType],
    foreignColumns: [entries.id, entries.type],
  }).onDelete('cascade')
}

/** Defines work-owned facts without introducing an extra work parent table. */
function workFields() {
  return {
    releaseDate: partialDate('release_date'),
    originalLanguages: languages('original_languages').notNull().default([]),
    backdropImageId: text('backdrop_image_id').references(() => attachments.id, {
      onDelete: 'restrict',
    }),
    titleLogoId: text('title_logo_id').references(() => attachments.id, { onDelete: 'restrict' }),
  }
}

/** Defines serial publication facts independently from personal completion. */
function serialFields() {
  return {
    releaseStatus: text('release_status', {
      enum: ['planned', 'ongoing', 'finished', 'paused', 'cancelled'],
    }),
    releaseEndDate: partialDate('release_end_date'),
  }
}

/** Supplies reverse indexes for the two work-specific attachment references. */
function workIndexes(
  name: string,
  fields: { backdropImageId: AnySQLiteColumn; titleLogoId: AnySQLiteColumn },
) {
  return [
    index(`${name}_backdrop`).on(fields.backdropImageId),
    index(`${name}_title_logo`).on(fields.titleLogoId),
  ]
}

const releaseStatuses = ['planned', 'ongoing', 'finished', 'paused', 'cancelled']
const genders = ['male', 'female', 'nonBinary', 'genderless', 'other'] as const

export const games = sqliteTable(
  'games',
  {
    ...entryIdentity('game'),
    ...workFields(),
    iconImageId: text('icon_image_id').references(() => attachments.id, { onDelete: 'restrict' }),
  },
  (table) => [
    primaryKey({ columns: [table.entryId] }),
    entryForeignKey(table.entryId, table.entryType),
    ...workIndexes('games', table),
    index('games_icon').on(table.iconImageId),
  ],
)

export const animes = sqliteTable(
  'animes',
  {
    ...entryIdentity('anime'),
    ...workFields(),
    ...serialFields(),
    declaredDurationMs: integer('declared_duration_ms'),
    declaredRegularEpisodeCount: integer('declared_regular_episode_count'),
    declaredSpecialEpisodeCount: integer('declared_special_episode_count'),
  },
  (table) => [
    primaryKey({ columns: [table.entryId] }),
    entryForeignKey(table.entryId, table.entryType),
    ...workIndexes('animes', table),
    enumValue('animes_release_status', table.releaseStatus, releaseStatuses),
    safeInteger('animes_duration', table.declaredDurationMs),
    safeInteger('animes_regular_count', table.declaredRegularEpisodeCount),
    safeInteger('animes_special_count', table.declaredSpecialEpisodeCount),
  ],
)

export const comics = sqliteTable(
  'comics',
  {
    ...entryIdentity('comic'),
    ...workFields(),
    ...serialFields(),
    declaredPageCount: integer('declared_page_count'),
    declaredVolumeCount: integer('declared_volume_count'),
    declaredChapterCount: integer('declared_chapter_count'),
  },
  (table) => [
    primaryKey({ columns: [table.entryId] }),
    entryForeignKey(table.entryId, table.entryType),
    ...workIndexes('comics', table),
    enumValue('comics_release_status', table.releaseStatus, releaseStatuses),
    safeInteger('comics_page_count', table.declaredPageCount),
    safeInteger('comics_volume_count', table.declaredVolumeCount),
    safeInteger('comics_chapter_count', table.declaredChapterCount),
  ],
)

export const novels = sqliteTable(
  'novels',
  {
    ...entryIdentity('novel'),
    ...workFields(),
    ...serialFields(),
    declaredPageCount: integer('declared_page_count'),
    declaredVolumeCount: integer('declared_volume_count'),
  },
  (table) => [
    primaryKey({ columns: [table.entryId] }),
    entryForeignKey(table.entryId, table.entryType),
    ...workIndexes('novels', table),
    enumValue('novels_release_status', table.releaseStatus, releaseStatuses),
    safeInteger('novels_page_count', table.declaredPageCount),
    safeInteger('novels_volume_count', table.declaredVolumeCount),
  ],
)

export const characters = sqliteTable(
  'characters',
  {
    ...entryIdentity('character'),
    birthDate: partialDate('birth_date'),
    gender: text('gender', { enum: genders }),
    bloodType: text('blood_type', { enum: ['a', 'b', 'ab', 'o'] }),
    age: characterMeasure('age'),
    height: characterMeasure('height'),
    weight: characterMeasure('weight'),
    bust: characterMeasure('bust'),
    waist: characterMeasure('waist'),
    hips: characterMeasure('hips'),
    cupSize: text('cup_size'),
  },
  (table) => [
    primaryKey({ columns: [table.entryId] }),
    entryForeignKey(table.entryId, table.entryType),
    enumValue('characters_gender', table.gender, genders),
    enumValue('characters_blood_type', table.bloodType, ['a', 'b', 'ab', 'o']),
  ],
)

export const persons = sqliteTable(
  'persons',
  {
    ...entryIdentity('person'),
    birthDate: partialDate('birth_date'),
    deathDate: partialDate('death_date'),
    gender: text('gender', { enum: genders }),
  },
  (table) => [
    primaryKey({ columns: [table.entryId] }),
    entryForeignKey(table.entryId, table.entryType),
    enumValue('persons_gender', table.gender, genders),
  ],
)

export const organizations = sqliteTable(
  'organizations',
  {
    ...entryIdentity('organization'),
    foundedDate: partialDate('founded_date'),
    dissolvedDate: partialDate('dissolved_date'),
  },
  (table) => [
    primaryKey({ columns: [table.entryId] }),
    entryForeignKey(table.entryId, table.entryType),
  ],
)

/** Creates the shared real-part fields; numbering and classification stay with each kind. */
function partFields() {
  return {
    id: idColumn(),
    name: text('name'),
    originalName: text('original_name'),
    aliases: aliases('aliases').notNull().default([]),
    description: text('description'),
    primaryImageId: text('primary_image_id').references(() => attachments.id, {
      onDelete: 'restrict',
    }),
    externalLinks: externalLinks('external_links').notNull().default([]),
    releaseDate: partialDate('release_date'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  }
}

/** Builds shared part integrity and owner-order indexes. */
function partConstraints(
  name: string,
  table: {
    id: AnySQLiteColumn
    primaryImageId: AnySQLiteColumn
    sortOrder: AnySQLiteColumn
    createdAt: AnySQLiteColumn
    updatedAt: AnySQLiteColumn
  },
  owner: AnySQLiteColumn,
) {
  return [
    nonempty(`${name}_id`, table.id),
    safeInteger(`${name}_order`, table.sortOrder),
    safeInteger(`${name}_created`, table.createdAt, Number.MIN_SAFE_INTEGER),
    safeInteger(`${name}_updated`, table.updatedAt, Number.MIN_SAFE_INTEGER),
    index(`${name}_owner_order`).on(owner, table.sortOrder, table.id),
    index(`${name}_primary_image`).on(table.primaryImageId),
  ]
}

export const animeEpisodes = sqliteTable(
  'anime_episodes',
  {
    ...partFields(),
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.entryId, { onDelete: 'cascade' }),
    numberLabel: text('number_label'),
    type: text('type', { enum: ['regular', 'special'] }),
    declaredDurationMs: integer('declared_duration_ms'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    ...partConstraints('anime_episodes', table, table.animeId),
    enumValue('anime_episodes_type', table.type, ['regular', 'special']),
    safeInteger('anime_episodes_duration', table.declaredDurationMs),
  ],
)

export const animeExtras = sqliteTable(
  'anime_extras',
  {
    ...partFields(),
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.entryId, { onDelete: 'cascade' }),
    type: text('type', { enum: ['opening', 'ending', 'promotion', 'interview', 'other'] }),
    declaredDurationMs: integer('declared_duration_ms'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    ...partConstraints('anime_extras', table, table.animeId),
    enumValue('anime_extras_type', table.type, [
      'opening',
      'ending',
      'promotion',
      'interview',
      'other',
    ]),
    safeInteger('anime_extras_duration', table.declaredDurationMs),
  ],
)

export const comicVolumes = sqliteTable(
  'comic_volumes',
  {
    ...partFields(),
    comicId: text('comic_id')
      .notNull()
      .references(() => comics.entryId, { onDelete: 'cascade' }),
    numberLabel: text('number_label'),
    declaredPageCount: integer('declared_page_count'),
    declaredChapterCount: integer('declared_chapter_count'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    ...partConstraints('comic_volumes', table, table.comicId),
    safeInteger('comic_volumes_pages', table.declaredPageCount),
    safeInteger('comic_volumes_chapters', table.declaredChapterCount),
  ],
)

export const comicChapters = sqliteTable(
  'comic_chapters',
  {
    ...partFields(),
    comicId: text('comic_id')
      .notNull()
      .references(() => comics.entryId, { onDelete: 'cascade' }),
    numberLabel: text('number_label'),
    declaredPageCount: integer('declared_page_count'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    ...partConstraints('comic_chapters', table, table.comicId),
    safeInteger('comic_chapters_pages', table.declaredPageCount),
  ],
)

export const novelVolumes = sqliteTable(
  'novel_volumes',
  {
    ...partFields(),
    novelId: text('novel_id')
      .notNull()
      .references(() => novels.entryId, { onDelete: 'cascade' }),
    numberLabel: text('number_label'),
    declaredPageCount: integer('declared_page_count'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    ...partConstraints('novel_volumes', table, table.novelId),
    safeInteger('novel_volumes_pages', table.declaredPageCount),
  ],
)

export const comicVolumeChapters = sqliteTable(
  'comic_volume_chapters',
  {
    volumeId: text('volume_id')
      .notNull()
      .references(() => comicVolumes.id, { onDelete: 'cascade' }),
    chapterId: text('chapter_id')
      .notNull()
      .references(() => comicChapters.id, { onDelete: 'cascade' }),
    numberLabel: text('number_label'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.volumeId, table.chapterId] }),
    safeInteger('comic_volume_chapters_order', table.sortOrder),
    index('comic_volume_chapters_ordered').on(table.volumeId, table.sortOrder, table.chapterId),
    index('comic_volume_chapters_reverse').on(table.chapterId, table.volumeId),
  ],
)

/** Declares exact external identities for one concrete owner table. */
function externalIdentities<TName extends string, TKey extends string>(
  name: TName,
  key: TKey,
  owner: AnySQLiteColumn,
) {
  return sqliteTable(
    name,
    {
      source: text('source').notNull(),
      sourceId: text('source_id').notNull(),
      ownerId: text(key)
        .notNull()
        .references(() => owner, { onDelete: 'cascade' }),
    },
    (table) => [
      primaryKey({ columns: [table.source, table.sourceId] }),
      nonempty(`${name}_source`, table.source),
      nonempty(`${name}_source_id`, table.sourceId),
      index(`${name}_owner`).on(table.ownerId),
    ],
  )
}

export const entryExternalIdentities = externalIdentities(
  'entry_external_identities',
  'entry_id',
  entries.id,
)
export const animeEpisodeExternalIdentities = externalIdentities(
  'anime_episode_external_identities',
  'episode_id',
  animeEpisodes.id,
)
export const animeExtraExternalIdentities = externalIdentities(
  'anime_extra_external_identities',
  'extra_id',
  animeExtras.id,
)
export const comicVolumeExternalIdentities = externalIdentities(
  'comic_volume_external_identities',
  'volume_id',
  comicVolumes.id,
)
export const comicChapterExternalIdentities = externalIdentities(
  'comic_chapter_external_identities',
  'chapter_id',
  comicChapters.id,
)
export const novelVolumeExternalIdentities = externalIdentities(
  'novel_volume_external_identities',
  'volume_id',
  novelVolumes.id,
)
