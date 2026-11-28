import type { PartCreate } from '@kisaki3/desktop-contracts/library'
import * as s from '../../../../infrastructure/database/schema'
import type { LibraryDatabase } from '../../transaction'
import type { PartRow } from '../creation'

export const comicParts = {
  comicChapter: {
    table: s.comicChapters,
    owner: s.comicChapters.comicId,
    ownerKey: 'comicId',
    record: s.comicChapterRecords,
    identities: s.comicChapterExternalIdentities,
    images: s.comicChapterDescriptionAttachments,
    files: s.comicFileChapters,
    activity: s.comicReadingActivity,
    activityPart: s.comicReadingActivity.chapterId,
  },
  comicVolume: {
    table: s.comicVolumes,
    owner: s.comicVolumes.comicId,
    ownerKey: 'comicId',
    record: s.comicVolumeRecords,
    identities: s.comicVolumeExternalIdentities,
    images: s.comicVolumeDescriptionAttachments,
    files: s.comicFileVolumes,
    activity: s.comicReadingActivity,
    activityPart: s.comicReadingActivity.volumeId,
  },
} as const

export function insertComicPart(
  db: LibraryDatabase,
  input: Extract<PartCreate, { type: 'comicChapter' | 'comicVolume' }>,
  common: PartRow,
) {
  if (input.type === 'comicChapter') {
    db.insert(comicParts.comicChapter.table)
      .values({ ...common, ...input.data, comicId: input.work.id })
      .run()
  } else {
    db.insert(comicParts.comicVolume.table)
      .values({ ...common, ...input.data, comicId: input.work.id })
      .run()
  }
}
