import { and, eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  WorkRef,
  DirectoryCreateFields,
  DirectoryUpdate,
  ExternalIdentity,
} from '@kisaki3/desktop-contracts/library'
import type { Storage } from '../../../../infrastructure/database'
import { commit, type LibraryWrite } from '../../transaction'
import { directories } from '../tables'
import { expectPositions, type Position } from '../paths'
import { expectOwner, visibleWork } from '../owner'
import { addDirectory, editDirectory, readDirectories } from './storage'

export function directoryCommands(storage: Storage) {
  return {
    listWorkDirectories: (work: WorkRef, sensitive: boolean) =>
      storage.transaction((db) => readDirectories(db, work, sensitive)),
    readWorkDirectory: (work: WorkRef, id: string, sensitive: boolean) =>
      storage.transaction((db) =>
        visibleWork(db, work, sensitive)
          ? (readDirectories(db, work, sensitive).find((row) => row.id === id) ?? null)
          : null,
      ),
    registerDirectory: (
      work: WorkRef,
      input: DirectoryCreateFields,
      baseline: readonly Position[],
      existing: string | null,
      identities?: readonly ExternalIdentity[],
    ) =>
      commit(storage, (write) => {
        expectOwner(write.db, work, identities)
        expectPositions(write.db, work, baseline)
        return { id: existing ?? addDirectory(write, work, input), created: !existing }
      }),
    editWorkDirectory: (work: WorkRef, id: string, input: DirectoryUpdate) =>
      commit(storage, (write) => editDirectory(write, work, id, input)),
    forgetDirectory: (work: WorkRef, id: string) =>
      commit(storage, (write) => {
        const { table, owner } = directories[work.type]
        if (
          !write.db
            .delete(table)
            .where(and(eq(owner, work.id), eq(table.id, id)))
            .run().changes
        ) {
          throw new DesktopError('NotFound', 'The directory no longer exists')
        }
        write.changes.push({ type: 'holdingsChanged', work, directoryIds: [id] } as Extract<
          LibraryWrite['changes'][number],
          { type: 'holdingsChanged' }
        >)
      }),
  }
}
