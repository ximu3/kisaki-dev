/** @fileoverview Declares each Markdown owner's exact attachment references with reverse lookup and restricted attachment deletion. */

import { index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { attachments } from './attachments'
import {
  entries,
  animeEpisodes,
  animeExtras,
  comicVolumes,
  comicChapters,
  novelVolumes,
} from './catalog'
import { collections, tags } from './organizers'
import {
  notes,
  gameAnnotations,
  animeAnnotations,
  comicAnnotations,
  novelAnnotations,
} from './notes'

/** Defines a concrete owner's reference set; this helper never creates a polymorphic owner table. */
function contentAttachments<TName extends string>(
  name: TName,
  ownerName: string,
  owner: AnySQLiteColumn,
) {
  return sqliteTable(
    name,
    {
      ownerId: text(ownerName)
        .notNull()
        .references(() => owner, { onDelete: 'cascade' }),
      attachmentId: text('attachment_id')
        .notNull()
        .references(() => attachments.id, { onDelete: 'restrict' }),
    },
    (table) => [
      primaryKey({ columns: [table.ownerId, table.attachmentId] }),
      index(`${name}_attachment`).on(table.attachmentId, table.ownerId),
    ],
  )
}

/**
 * Tracks attachment references held by entry descriptions for reverse lookup and restricted
 * attachment deletion.
 */
export const entryDescriptionAttachments = contentAttachments(
  'entry_description_attachments',
  'entry_id',
  entries.id,
)

/**
 * Tracks attachment references held by episode descriptions for reverse lookup and restricted
 * attachment deletion.
 */
export const animeEpisodeDescriptionAttachments = contentAttachments(
  'anime_episode_description_attachments',
  'episode_id',
  animeEpisodes.id,
)

/**
 * Tracks attachment references held by anime-extra descriptions for reverse lookup and restricted
 * attachment deletion.
 */
export const animeExtraDescriptionAttachments = contentAttachments(
  'anime_extra_description_attachments',
  'extra_id',
  animeExtras.id,
)

/**
 * Tracks attachment references held by comic-volume descriptions for reverse lookup and restricted
 * attachment deletion.
 */
export const comicVolumeDescriptionAttachments = contentAttachments(
  'comic_volume_description_attachments',
  'volume_id',
  comicVolumes.id,
)

/**
 * Tracks attachment references held by comic-chapter descriptions for reverse lookup and
 * restricted attachment deletion.
 */
export const comicChapterDescriptionAttachments = contentAttachments(
  'comic_chapter_description_attachments',
  'chapter_id',
  comicChapters.id,
)

/**
 * Tracks attachment references held by novel-volume descriptions for reverse lookup and restricted
 * attachment deletion.
 */
export const novelVolumeDescriptionAttachments = contentAttachments(
  'novel_volume_description_attachments',
  'volume_id',
  novelVolumes.id,
)

/**
 * Tracks attachment references held by collection descriptions for reverse lookup and restricted
 * attachment deletion.
 */
export const collectionDescriptionAttachments = contentAttachments(
  'collection_description_attachments',
  'collection_id',
  collections.id,
)

/**
 * Tracks attachment references held by tag descriptions for reverse lookup and restricted
 * attachment deletion.
 */
export const tagDescriptionAttachments = contentAttachments(
  'tag_description_attachments',
  'tag_id',
  tags.id,
)

/**
 * Tracks attachment references held by note bodies for reverse lookup and restricted attachment
 * deletion.
 */
export const noteContentAttachments = contentAttachments(
  'note_content_attachments',
  'note_id',
  notes.id,
)

/**
 * Tracks attachment references held by game annotation bodies for reverse lookup and restricted
 * attachment deletion.
 */
export const gameAnnotationContentAttachments = contentAttachments(
  'game_annotation_content_attachments',
  'annotation_id',
  gameAnnotations.id,
)

/**
 * Tracks attachment references held by anime annotation bodies for reverse lookup and restricted
 * attachment deletion.
 */
export const animeAnnotationContentAttachments = contentAttachments(
  'anime_annotation_content_attachments',
  'annotation_id',
  animeAnnotations.id,
)

/**
 * Tracks attachment references held by comic annotation bodies for reverse lookup and restricted
 * attachment deletion.
 */
export const comicAnnotationContentAttachments = contentAttachments(
  'comic_annotation_content_attachments',
  'annotation_id',
  comicAnnotations.id,
)

/**
 * Tracks attachment references held by novel annotation bodies for reverse lookup and restricted
 * attachment deletion.
 */
export const novelAnnotationContentAttachments = contentAttachments(
  'novel_annotation_content_attachments',
  'annotation_id',
  novelAnnotations.id,
)
