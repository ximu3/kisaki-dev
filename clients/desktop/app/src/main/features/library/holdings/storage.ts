import type { WorkRef } from '@kisaki3/desktop-contracts/library'
import type { Storage } from '../../../infrastructure/database'
import { gameBackupRecoveries } from '../../../infrastructure/database/schema'
import { positions } from './paths'
import { watchTargets } from './maintenance/watch/targets'
import { directoryCommands } from './directories/commands'
import { fileCommands } from './files/commands'

export function holdingStorage(storage: Storage) {
  return {
    ...directoryCommands(storage),
    ...fileCommands(storage),
    watchTargets: () => storage.transaction(watchTargets),
    libraryPositions: (work: WorkRef) => storage.transaction((db) => positions(db, work)),
    recoveryPaths: () =>
      storage.db
        .select({ path: gameBackupRecoveries.workspacePath })
        .from(gameBackupRecoveries)
        .all()
        .map((row) => row.path),
  }
}
