import type { PartCreate } from '@kisaki3/desktop-contracts/library'
import type { LibraryDatabase } from '../transaction'
import * as s from '../../../infrastructure/database/schema'
import type { PartRow } from './creation'

export const novelParts = {
  novelVolume: {
    table: s.novelVolumes,
    owner: s.novelVolumes.novelId,
    ownerKey: 'novelId',
    record: s.novelVolumeRecords,
    identities: s.novelVolumeExternalIdentities,
    images: s.novelVolumeDescriptionAttachments,
    files: s.novelFileVolumes,
    activity: s.novelReadingActivity,
    activityPart: s.novelReadingActivity.volumeId,
  },
} as const

export function insertNovelPart(
  db: LibraryDatabase,
  input: Extract<PartCreate, { type: 'novelVolume' }>,
  common: PartRow,
) {
  db.insert(novelParts.novelVolume.table)
    .values({ ...common, ...input.data, novelId: input.work.id })
    .run()
}
