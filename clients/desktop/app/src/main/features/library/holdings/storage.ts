import type { WorkRef } from '@kisaki3/desktop-contracts/library'
import type { Storage } from '../../../infrastructure/database'
import { directoryCommands } from './directories/storage'
import { fileCommands } from './files/storage'
import { recoveryPaths } from './game/backups'
import { watchTargets } from './maintenance/watch/targets'
import { positions } from './paths'

export function holdingStorage(storage: Storage) {
  return {
    ...directoryCommands(storage),
    ...fileCommands(storage),
    watchTargets: () => storage.transaction(watchTargets),
    libraryPositions: (work: WorkRef) => storage.transaction((db) => positions(db, work)),
    recoveryPaths: () => recoveryPaths(storage.db),
  }
}
