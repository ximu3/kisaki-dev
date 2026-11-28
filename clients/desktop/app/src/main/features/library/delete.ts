import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { type EntryRef, parseEntryRef } from '@kisaki3/desktop-contracts/library'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import { eq } from 'drizzle-orm'
import type { Storage } from '../../infrastructure/database'
import type { DatabaseCall } from '../../infrastructure/database/executor'
import { entries } from '../../infrastructure/database/schema'
import { retireImages } from './attachments/release'
import {
  type ChangeAdmission,
  type dependencyStorage,
  type UseTarget,
  verify,
} from './change-admission'
import { snapshot } from './entries/snapshot'
import { guardGameDeletion } from './holdings/game/backups'
import { unlinkEntryNotes } from './records/notes/members'
import { type CompleteWrite, commit } from './transaction'

export function entryDeletion(
  call: DatabaseCall<ReturnType<typeof deletionStorage> & ReturnType<typeof dependencyStorage>>,
  admit: ChangeAdmission,
  complete: CompleteWrite,
) {
  return async function deleteEntries(raw: unknown, options?: CallOptions) {
    if (!Array.isArray(raw) || !raw.length) {
      throw new DesktopError('InvalidInput', 'Select one or more entries')
    }
    const refs = raw.map(parseEntryRef)
    if (new Set(refs.map((ref) => ref.id)).size !== refs.length) {
      throw new DesktopError('InvalidInput', 'Select each entry once')
    }
    const affected = await call('entryDependencies', refs)
    options?.signal?.throwIfAborted()
    complete(await admit(affected, () => call('deleteLibraryEntries', refs, affected)))
  }
}

export function deletionStorage(storage: Storage) {
  return {
    deleteLibraryEntries: (refs: readonly EntryRef[], baseline: readonly UseTarget[]) =>
      commit(storage, (write) => {
        verify(write, refs, baseline)
        for (const ref of refs) {
          const original = snapshot(write.db, ref)
          if (ref.type === 'game') {
            guardGameDeletion(write, ref.id)
          }
          retireImages(write, ref)
          unlinkEntryNotes(write, ref)
          write.db.delete(entries).where(eq(entries.id, ref.id)).run()
          write.changes.push({ type: 'entryDeleted', snapshot: original })
        }
      }),
  }
}
