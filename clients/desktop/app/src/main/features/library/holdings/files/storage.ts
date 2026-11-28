import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  ExternalIdentity,
  FileAssociationEdit,
  FileAvailability,
  FileCreateFields,
  FileMergeInput,
  FileQuery,
  PreferredFileInput,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import { and, eq } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'
import type { Storage } from '../../../../infrastructure/database'
import { ready } from '../../../../infrastructure/database/codecs/json'
import { commit } from '../../transaction'
import { directories } from '../directories/tables'
import { expectPositions, type Position } from '../paths'
import { expectOwner, visibleWork } from '../work'
import { directLinks, editAssociations, preferFile } from './associations'
import { mergeFile } from './merge'
import { listFiles, readFile } from './read'
import { fileChange, fileRow, storeFileFacts, type FileFacts, type FileWork } from './record'
import { mediaFiles } from './tables'
import { addFile, moveFile } from './write'

export function fileCommands(storage: Storage) {
  return {
    listWorkFiles: (
      work: FileWork,
      query: FileQuery,
      range: ListOptions,
      sensitive: boolean,
      ids: readonly string[] | null,
    ) =>
      storage.transaction((db) => {
        if (!visibleWork(db, work, sensitive)) {
          throw new DesktopError('NotFound', 'The work is unavailable')
        }
        return listFiles(db, work, query, range, ids)
      }),
    readWorkFile: (work: FileWork, id: string, sensitive: boolean) =>
      storage.transaction((db) => {
        const { table, owner } = mediaFiles[work.type]
        return visibleWork(db, work, sensitive) &&
          db
            .select({ id: table.id })
            .from(table)
            .where(and(eq(owner, work.id), eq(table.id, id)))
            .get()
          ? readFile(db, work, id)
          : null
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
