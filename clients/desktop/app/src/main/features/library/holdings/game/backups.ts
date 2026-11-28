import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { WorkRef } from '@kisaki3/desktop-contracts/library'
import { eq } from 'drizzle-orm'
import * as s from '../../../../infrastructure/database/schema'
import { gameBackupRecoveries } from '../../../../infrastructure/database/schema'
import type { LibraryDatabase, LibraryWrite } from '../../transaction'

export function releaseBackupImages(write: LibraryWrite, id: string) {
  const { db } = write
  for (const row of db
    .select({ id: s.gameSaveBackups.archiveAttachmentId })
    .from(s.gameSaveBackups)
    .where(eq(s.gameSaveBackups.gameId, id))
    .all()) {
    write.released.add(row.id)
  }
}

export function guardGameDeletion(write: LibraryWrite, id: string) {
  const recoveries = write.db
    .select()
    .from(gameBackupRecoveries)
    .where(eq(gameBackupRecoveries.gameId, id))
    .all()
  if (recoveries.some((row) => row.resolution === null)) {
    throw new DesktopError('Conflict', 'Resolve the pending save recovery before deleting the game')
  }
  write.db.delete(gameBackupRecoveries).where(eq(gameBackupRecoveries.gameId, id)).run()
}

export function moveBackups(write: LibraryWrite, source: WorkRef, target: WorkRef) {
  const { db } = write
  db.update(s.gameSaveBackups)
    .set({ gameId: target.id })
    .where(eq(s.gameSaveBackups.gameId, source.id))
    .run()
  db.update(s.gameBackupRecoveries)
    .set({ gameId: target.id })
    .where(eq(s.gameBackupRecoveries.gameId, source.id))
    .run()
}

export function recoveryPaths(db: LibraryDatabase) {
  return db
    .select({ path: gameBackupRecoveries.workspacePath })
    .from(gameBackupRecoveries)
    .all()
    .map((row) => row.path)
}
