import { isWorkType, type EntryRef } from '@kisaki3/desktop-contracts/library'
import { retireEntryImages } from '../entries/images'
import { releaseBackupImages } from '../holdings/game/backups'
import { releaseWorkPartImages } from '../parts/images'
import { releaseAnnotationImages } from '../records/annotations/references'
import type { LibraryWrite } from '../transaction'

export function retireImages(write: LibraryWrite, ref: EntryRef) {
  retireEntryImages(write, ref)
  if (isWorkType(ref.type)) {
    const work = { type: ref.type, id: ref.id }
    releaseAnnotationImages(write, work)
    releaseWorkPartImages(write, work)
    if (ref.type === 'game') {
      releaseBackupImages(write, ref.id)
    }
  }
}
