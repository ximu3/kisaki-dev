/** @fileoverview Declares each Markdown owner's exact attachment references with reverse lookup and restricted attachment deletion. */

import { index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { attachments } from './metadata'
import {
  entries,
  animeEpisodes,
  animeExtras,
  comicVolumes,
  comicChapters,
  novelVolumes,
} from '../catalog'
import { collections, tags } from '../organizers'
import {
  notes,
  gameAnnotations,
  animeAnnotations,
  comicAnnotations,
  novelAnnotations,
} from '../notes'

/** Links each Markdown owner to its attachments, with reverse lookup and restricted deletion. */
function markdownReferences<TName extends string>(
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

/** Tracks attachments referenced by entry descriptions. */
export const entryDescriptionAttachments = markdownReferences(
  'entry_description_attachments',
  'entry_id',
  entries.id,
)

/** Tracks attachments referenced by anime episode descriptions. */
export const animeEpisodeDescriptionAttachments = markdownReferences(
  'anime_episode_description_attachments',
  'episode_id',
  animeEpisodes.id,
)

/** Tracks attachments referenced by anime extra descriptions. */
export const animeExtraDescriptionAttachments = markdownReferences(
  'anime_extra_description_attachments',
  'extra_id',
  animeExtras.id,
)

/** Tracks attachments referenced by comic volume descriptions. */
export const comicVolumeDescriptionAttachments = markdownReferences(
  'comic_volume_description_attachments',
  'volume_id',
  comicVolumes.id,
)

/** Tracks attachments referenced by comic chapter descriptions. */
export const comicChapterDescriptionAttachments = markdownReferences(
  'comic_chapter_description_attachments',
  'chapter_id',
  comicChapters.id,
)

/** Tracks attachments referenced by novel volume descriptions. */
export const novelVolumeDescriptionAttachments = markdownReferences(
  'novel_volume_description_attachments',
  'volume_id',
  novelVolumes.id,
)

/** Tracks attachments referenced by collection descriptions. */
export const collectionDescriptionAttachments = markdownReferences(
  'collection_description_attachments',
  'collection_id',
  collections.id,
)

/** Tracks attachments referenced by tag descriptions. */
export const tagDescriptionAttachments = markdownReferences(
  'tag_description_attachments',
  'tag_id',
  tags.id,
)

/** Tracks attachments referenced by note bodies. */
export const noteContentAttachments = markdownReferences(
  'note_content_attachments',
  'note_id',
  notes.id,
)

/** Tracks attachments referenced by game annotation bodies. */
export const gameAnnotationContentAttachments = markdownReferences(
  'game_annotation_content_attachments',
  'annotation_id',
  gameAnnotations.id,
)

/** Tracks attachments referenced by anime annotation bodies. */
export const animeAnnotationContentAttachments = markdownReferences(
  'anime_annotation_content_attachments',
  'annotation_id',
  animeAnnotations.id,
)

/** Tracks attachments referenced by comic annotation bodies. */
export const comicAnnotationContentAttachments = markdownReferences(
  'comic_annotation_content_attachments',
  'annotation_id',
  comicAnnotations.id,
)

/** Tracks attachments referenced by novel annotation bodies. */
export const novelAnnotationContentAttachments = markdownReferences(
  'novel_annotation_content_attachments',
  'annotation_id',
  novelAnnotations.id,
)
