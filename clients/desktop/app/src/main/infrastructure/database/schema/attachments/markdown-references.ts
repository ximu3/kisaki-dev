import { index, primaryKey, sqliteTable, text, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
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

export const entryDescriptionAttachments = markdownReferences(
  'entry_description_attachments',
  'entry_id',
  entries.id,
)

export const animeEpisodeDescriptionAttachments = markdownReferences(
  'anime_episode_description_attachments',
  'episode_id',
  animeEpisodes.id,
)

export const animeExtraDescriptionAttachments = markdownReferences(
  'anime_extra_description_attachments',
  'extra_id',
  animeExtras.id,
)

export const comicVolumeDescriptionAttachments = markdownReferences(
  'comic_volume_description_attachments',
  'volume_id',
  comicVolumes.id,
)

export const comicChapterDescriptionAttachments = markdownReferences(
  'comic_chapter_description_attachments',
  'chapter_id',
  comicChapters.id,
)

export const novelVolumeDescriptionAttachments = markdownReferences(
  'novel_volume_description_attachments',
  'volume_id',
  novelVolumes.id,
)

export const collectionDescriptionAttachments = markdownReferences(
  'collection_description_attachments',
  'collection_id',
  collections.id,
)

export const tagDescriptionAttachments = markdownReferences(
  'tag_description_attachments',
  'tag_id',
  tags.id,
)

export const noteContentAttachments = markdownReferences(
  'note_content_attachments',
  'note_id',
  notes.id,
)

export const gameAnnotationContentAttachments = markdownReferences(
  'game_annotation_content_attachments',
  'annotation_id',
  gameAnnotations.id,
)

export const animeAnnotationContentAttachments = markdownReferences(
  'anime_annotation_content_attachments',
  'annotation_id',
  animeAnnotations.id,
)

export const comicAnnotationContentAttachments = markdownReferences(
  'comic_annotation_content_attachments',
  'annotation_id',
  comicAnnotations.id,
)

export const novelAnnotationContentAttachments = markdownReferences(
  'novel_annotation_content_attachments',
  'annotation_id',
  novelAnnotations.id,
)
