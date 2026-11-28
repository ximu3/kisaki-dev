import { isDeepStrictEqual } from 'node:util'
import { eq, sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  isWorkType,
  type EntryRef,
  type EntryMergeInput,
  type EntryIdentitySnapshot,
} from '@kisaki3/desktop-contracts/library'
import {
  entries,
  gameBackupRecoveries,
  noteEntryLinks,
} from '../../../../infrastructure/database/schema'
import type { Storage } from '../../../../infrastructure/database'
import type { UseTarget } from '../../../../infrastructure/use-targets'
import { expectPositions } from '../../holdings/positions'
import { commit, type LibraryWrite } from '../../transaction'
import { snapshot, dependencies, retireEntryImages } from './snapshots'
import { mergeFields } from './fields'
import { mergeEntryRelations } from './relations'
import { mergeMembers } from './members'
import { mergeWork } from './work'
import { redirectQueries } from './queries'
import type { MergeLocations } from './locations'

function verify(write: LibraryWrite, refs: readonly EntryRef[], baseline: readonly UseTarget[]) {
  if (!isDeepStrictEqual(dependencies(write.db, refs), baseline)) {
    throw new DesktopError(
      'TargetChanged',
      'The selected entries acquired or lost dependent records',
    )
  }
}
export function identityStorage(storage: Storage) {
  return {
    entryDependencies: (refs: readonly EntryRef[]) =>
      storage.transaction((db) => dependencies(db, refs)),
    deleteLibraryEntries: (refs: readonly EntryRef[], baseline: readonly UseTarget[]) =>
      commit(storage, (write) => {
        verify(write, refs, baseline)
        for (const ref of refs) {
          const original = snapshot(write.db, ref)
          if (ref.type === 'game') {
            const recoveries = write.db
              .select()
              .from(gameBackupRecoveries)
              .where(eq(gameBackupRecoveries.gameId, ref.id))
              .all()
            if (recoveries.some((row) => row.resolution === null)) {
              throw new DesktopError(
                'Conflict',
                'Resolve the pending save recovery before deleting the game',
              )
            }
            write.db
              .delete(gameBackupRecoveries)
              .where(eq(gameBackupRecoveries.gameId, ref.id))
              .run()
          }
          retireEntryImages(write, ref)
          for (const row of write.db
            .select({ id: noteEntryLinks.noteId })
            .from(noteEntryLinks)
            .where(eq(noteEntryLinks.entryId, ref.id))
            .all()) {
            write.changes.push({ type: 'noteUpdated', noteId: row.id, entries: [ref] })
          }
          write.db.delete(entries).where(eq(entries.id, ref.id)).run()
          write.changes.push({ type: 'entryDeleted', snapshot: original })
        }
      }),
    mergeLibraryEntries: (
      input: EntryMergeInput,
      locations: MergeLocations,
      baseline: readonly UseTarget[],
    ) =>
      commit(storage, (write) => {
        const { sources, target } = input,
          { db } = write,
          original = snapshot(db, target)
        verify(write, [target, ...sources], baseline)
        for (const scope of locations.baseline) {
          expectPositions(db, scope.work, scope.positions)
        }
        db.run(sql`pragma defer_foreign_keys=on`)
        const snapshots: EntryIdentitySnapshot[] = []
        for (const source of sources) {
          snapshots.push(snapshot(db, source))
          retireEntryImages(write, source)
          mergeFields(write, source, target)
          mergeMembers(write, source, target)
          mergeEntryRelations(write, source, target)
          if (isWorkType(target.type)) {
            mergeWork(
              write,
              { type: target.type, id: source.id },
              { type: target.type, id: target.id },
              locations,
            )
          }
          redirectQueries(write, source, target, original.name)
          db.delete(entries).where(eq(entries.id, source.id)).run()
        }
        const [first, ...rest] = snapshots
        if (first) {
          write.changes.push({ type: 'entriesMerged', sources: [first, ...rest], target })
        }
        return target
      }),
  }
}
