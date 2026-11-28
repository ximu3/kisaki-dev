import { isDeepStrictEqual } from 'node:util'
import { and, eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  WorkRef,
  DirectoryCreateFields,
  DirectoryUpdate,
  FileCreateFields,
  FileQuery,
  FileAssociationEdit,
  PreferredFileInput,
  FileAvailability,
  ExternalIdentity,
  FileMergeInput,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import type { Storage } from '../../../infrastructure/database'
import { ready } from '../../../infrastructure/database/codecs/json'
import {
  entries,
  gameBackupRecoveries,
  gameLaunchConfigs,
} from '../../../infrastructure/database/schema'
import type {
  GameLaunchConfig,
  LocalContentRegistrationResult,
} from '@kisaki3/desktop-contracts/library'
import { addConfig } from './game/configurations'
import { requireEntry, entryWhere } from '../entries/tables'
import { findIdentity } from '../entries/identities'
import { commit, type LibraryDatabase, type LibraryWrite } from '../transaction'
import { directories, mediaFiles } from './tables'
import { addDirectory, editDirectory, readDirectories } from './directories/storage'
import { positions, expectPositions, type Position } from './positions'
import {
  addFile,
  readFile,
  listFiles,
  fileRow,
  directLinks,
  storeFileFacts,
  editAssociations,
  preferFile,
  fileChange,
  type FileWork,
  type FileFacts,
} from './files/storage'
import { mergeFile } from './files/merge'

export function expectOwner(
  db: LibraryDatabase,
  work: WorkRef,
  identities?: readonly ExternalIdentity[],
) {
  requireEntry(db, work)
  for (const identity of identities ?? []) {
    const owner = findIdentity(db, identity)
    if (owner?.id !== work.id || owner.type !== work.type) {
      throw new DesktopError('Conflict', 'The external identity no longer belongs to this work')
    }
  }
}
function visible(db: LibraryDatabase, work: WorkRef, sensitive: boolean) {
  return !!db
    .select({ id: entries.id })
    .from(entries)
    .where(and(entryWhere(work), sensitive ? undefined : eq(entries.isNsfw, false)))
    .get()
}
export function moveFile(
  write: LibraryWrite,
  work: FileWork,
  id: string,
  path: string,
  facts: FileFacts,
) {
  const row = fileRow(write.db, work, id)
  if (('kind' in row ? row.kind : 'file') !== facts.kind) {
    throw new DesktopError('InvalidReference', 'The destination must be the same content type')
  }
  if (row.path === path) {
    return
  }
  const table = mediaFiles[work.type].table
  write.db
    .update(table)
    .set({
      path,
      availability: ready<FileAvailability>({ status: 'accessible', checkedAt: write.now }),
      updatedAt: write.now,
    })
    .where(eq(table.id, id))
    .run()
  storeFileFacts(write.db, work, id, facts)
  fileChange(write, work, [id])
}
import { watchTargets } from './watch-targets'

export function holdingStorage(storage: Storage) {
  return {
    watchTargets: () => storage.transaction(watchTargets),
    libraryPositions: (work: WorkRef) => storage.transaction((db) => positions(db, work)),
    recoveryPaths: () =>
      storage.db
        .select({ path: gameBackupRecoveries.workspacePath })
        .from(gameBackupRecoveries)
        .all()
        .map((row) => row.path),
    listWorkDirectories: (work: WorkRef, sensitive: boolean) =>
      storage.transaction((db) => readDirectories(db, work, sensitive)),
    readWorkDirectory: (work: WorkRef, id: string, sensitive: boolean) =>
      storage.transaction((db) =>
        visible(db, work, sensitive)
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

    listWorkFiles: (
      work: FileWork,
      query: FileQuery,
      range: ListOptions,
      sensitive: boolean,
      ids: readonly string[] | null,
    ) =>
      storage.transaction((db) => {
        if (!visible(db, work, sensitive)) {
          throw new DesktopError('NotFound', 'The work is unavailable')
        }
        return listFiles(db, work, query, range, ids)
      }),
    readWorkFile: (work: FileWork, id: string, sensitive: boolean) =>
      storage.transaction((db) => {
        const { table, owner } = mediaFiles[work.type]
        return visible(db, work, sensitive) &&
          db
            .select({ id: table.id })
            .from(table)
            .where(and(eq(owner, work.id), eq(table.id, id)))
            .get()
          ? readFile(db, work, id)
          : null
      }),
    registerGameTarget: (
      work: WorkRef<'game'>,
      path: string,
      name: string,
      before: readonly GameLaunchConfig[],
      matched: readonly string[],
      identities?: readonly ExternalIdentity[],
    ) =>
      commit(storage, (write) => {
        expectOwner(write.db, work, identities)
        const rows = write.db
          .select()
          .from(gameLaunchConfigs)
          .where(eq(gameLaunchConfigs.gameId, work.id))
          .orderBy(gameLaunchConfigs.sortOrder, gameLaunchConfigs.id)
          .all()
        const paths = (items: readonly GameLaunchConfig[]) =>
          items.map((item) => ({
            id: item.id,
            launch: item.definition.status === 'ready' ? item.definition.value.launch : null,
          }))
        if (!isDeepStrictEqual(paths(rows), paths(before))) {
          throw new DesktopError('TargetChanged', 'A launch target changed during registration')
        }
        const ids = matched.length
          ? matched
          : [
              addConfig(write, work.id, {
                name,
                definition: {
                  launch: { type: 'file', path },
                  monitor: { type: 'file', path: null },
                  timing: 'foreground',
                  savePath: null,
                  backupRetentionCount: null,
                  autoBackupEnabled: false,
                },
              }),
            ]
        const registrations = ids.map((id) => ({
          type: 'launchConfig' as const,
          id,
          outcome: matched.length ? ('alreadyRegistered' as const) : ('registered' as const),
        }))
        const issues = ids.flatMap((id) => {
          const item = rows.find((row) => row.id === id)
          const monitor = item?.definition.status === 'ready' ? item.definition.value.monitor : null
          return !monitor || !(monitor.type === 'process' ? monitor.name : monitor.path)
            ? [{ code: 'launchConfigIncomplete' as const, launchConfigId: id }]
            : []
        })
        return {
          work,
          registrations: [registrations[0]!, ...registrations.slice(1)],
          issues,
        } satisfies LocalContentRegistrationResult<'game'>
      }),
    registerFile: (
      work: FileWork,
      input: FileCreateFields,
      facts: FileFacts,
      baseline: readonly Position[],
      existing: string | null,
      identities?: readonly ExternalIdentity[],
      discovery?: { id: string; path: string; definition: unknown },
    ) =>
      commit(storage, (write) => {
        if (discovery) {
          const { table, owner } = directories[work.type]
          const actual = write.db
            .select()
            .from(table)
            .where(and(eq(table.id, discovery.id), eq(owner, work.id)))
            .get()
          if (
            !actual ||
            actual.path !== discovery.path ||
            actual.definition.status !== 'ready' ||
            !isDeepStrictEqual(actual.definition.value, discovery.definition)
          ) {
            throw new DesktopError('TargetChanged', 'The discovery directory or its rules changed')
          }
        }
        expectOwner(write.db, work, identities)
        expectPositions(write.db, work, baseline)
        if (existing && input.associations) {
          editAssociations(
            write,
            work,
            existing,
            { change: { type: 'modify', add: input.associations } },
            true,
          )
        }
        return { id: existing ?? addFile(write, work, input, facts), created: !existing }
      }),
    changeFileNote: (
      work: FileWork,
      id: string,
      note: string | null | undefined,
      expected: string | null | undefined,
    ) =>
      commit(storage, (write) => {
        const row = fileRow(write.db, work, id)
        if (expected !== undefined && row.note !== expected) {
          throw new DesktopError('Conflict', 'The file note changed')
        }
        if (note !== undefined && row.note !== note) {
          const table = mediaFiles[work.type].table
          write.db.update(table).set({ note, updatedAt: write.now }).where(eq(table.id, id)).run()
          fileChange(write, work, [id])
        }
      }),
    removeWorkFiles: (work: FileWork, ids: readonly string[]) =>
      commit(storage, (write) => {
        const { table, owner } = mediaFiles[work.type]
        for (const id of ids) {
          if (
            !write.db
              .delete(table)
              .where(and(eq(table.id, id), eq(owner, work.id)))
              .run().changes
          ) {
            throw new DesktopError('NotFound', 'The file no longer exists')
          }
        }
        fileChange(write, work, ids)
      }),
    preferWorkFiles: (work: FileWork, values: readonly PreferredFileInput[]) =>
      commit(storage, (write) => {
        for (const value of values) {
          preferFile(write, work, value)
        }
      }),
    changeFileParts: (work: FileWork, id: string, input: FileAssociationEdit, admitted: boolean) =>
      commit(storage, (write) => editAssociations(write, work, id, input, true, admitted)),
    setFileMode: (
      work: FileWork,
      id: string,
      mode: 'manual' | 'automatic',
      expected: 'manual' | 'automatic' | undefined,
    ) =>
      commit(storage, (write) => {
        const row = fileRow(write.db, work, id)
        if (expected !== undefined && row.associationMode !== expected) {
          throw new DesktopError('Conflict', 'File association mode changed')
        }
        if (row.associationMode !== mode) {
          const table = mediaFiles[work.type].table
          write.db
            .update(table)
            .set({ associationMode: mode, updatedAt: write.now })
            .where(eq(table.id, id))
            .run()
          fileChange(write, work, [id])
          return mode === 'automatic' && !directLinks(write.db, work, id).length
        }
        return false
      }),
    mergeWorkFiles: (
      work: FileWork,
      input: FileMergeInput,
      facts: FileFacts,
      before: readonly Position[],
    ) =>
      commit(storage, (write) => {
        expectPositions(write.db, work, before)
        return mergeFile(write, work, input, facts)
      }),
    relocateWorkFile: (
      work: FileWork,
      id: string,
      path: string,
      facts: FileFacts,
      before: readonly Position[],
    ) =>
      commit(storage, (write) => {
        expectPositions(write.db, work, before)
        moveFile(write, work, id, path, facts)
      }),
    checkWorkFile: (
      work: FileWork,
      id: string,
      path: string,
      availability: FileAvailability,
      facts: FileFacts | null,
    ) =>
      commit(storage, (write) => {
        const row = fileRow(write.db, work, id)
        if (row.path !== path) {
          throw new DesktopError('TargetChanged', 'The registered path changed during inspection')
        }
        const data = facts && ('book' in facts ? facts.book : facts.video)
        const table = mediaFiles[work.type].table
        if (
          !isDeepStrictEqual(row.availability, ready(availability)) ||
          (data && !isDeepStrictEqual(row.metadata, ready(data)))
        ) {
          if (facts) {
            storeFileFacts(write.db, work, id, facts)
          }
          write.db
            .update(table)
            .set({ availability: ready(availability) })
            .where(eq(table.id, id))
            .run()
          fileChange(write, work, [id])
        }
      }),
  }
}
