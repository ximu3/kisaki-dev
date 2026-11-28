import type { PartCreate } from '@kisaki3/desktop-contracts/library'
import * as s from '../../../../infrastructure/database/schema'
import type { LibraryDatabase } from '../../transaction'
import type { PartRow } from '../creation'

export const animeParts = {
  animeEpisode: {
    table: s.animeEpisodes,
    owner: s.animeEpisodes.animeId,
    ownerKey: 'animeId',
    record: s.animeEpisodeRecords,
    identities: s.animeEpisodeExternalIdentities,
    images: s.animeEpisodeDescriptionAttachments,
    files: s.animeFileEpisodes,
    activity: s.animeWatchActivity,
    activityPart: s.animeWatchActivity.episodeId,
  },
  animeExtra: {
    table: s.animeExtras,
    owner: s.animeExtras.animeId,
    ownerKey: 'animeId',
    record: s.animeExtraRecords,
    identities: s.animeExtraExternalIdentities,
    images: s.animeExtraDescriptionAttachments,
    files: s.animeFileExtras,
    activity: s.animeWatchActivity,
    activityPart: s.animeWatchActivity.extraId,
  },
} as const

export function insertAnimePart(
  db: LibraryDatabase,
  input: Extract<PartCreate, { type: 'animeEpisode' | 'animeExtra' }>,
  common: PartRow,
) {
  if (input.type === 'animeEpisode') {
    db.insert(animeParts.animeEpisode.table)
      .values({ ...common, ...input.data, animeId: input.work.id })
      .run()
  } else {
    db.insert(animeParts.animeExtra.table)
      .values({ ...common, ...input.data, animeId: input.work.id })
      .run()
  }
}
