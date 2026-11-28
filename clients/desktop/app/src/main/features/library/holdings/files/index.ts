import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseFileCreateFields,
  parseFileQuery,
  parseFileMergeInput,
  parseFileAssociationEdit,
  parseFileAssociationModeChange,
  parsePreferredFileInput,
  parsePreferredPartFiles,
  type FilePlaybackChoicesApi,
  type FileWorkType,
  type WorkRef,
  type HeldFile,
  type FileRecognitionResult,
  type FileReidentificationResult,
  type HoldingsRelocationResult,
} from '@kisaki3/desktop-contracts/library'
import {
  parseListOptions,
  type CallOptions,
  type ListResult,
} from '@kisaki3/desktop-contracts/operations'
import * as v from 'valibot'
import type { NativeFiles } from '#native'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import { normalizeAbsolutePath } from '../../../../infrastructure/files'
import { registeredRelation } from '../../../../infrastructure/files/registered-path'
import { inspectVideo } from '../../../../infrastructure/media/inspect'
import type { ChangeAdmission } from '../../change-admission'
import type { CompleteWrite } from '../../transaction'
import { fileWork, callSignal } from '../work'
import type { createRegistration } from '../registration/queue'
import type { createRecognition } from '../recognition'
import { existingPosition } from '../paths'
import type { holdingStorage } from '../storage'
import { inspectTarget } from './inspect'
import type { createFileRelocation } from './relocate'

export function createFiles(
  call: DatabaseCall<ReturnType<typeof holdingStorage>>,
  native: NativeFiles,
  resources: string,
  sensitive: () => boolean,
  complete: CompleteWrite,
  admit: ChangeAdmission,
  register: ReturnType<typeof createRegistration>,
  recognition: ReturnType<typeof createRecognition>,
  relocateFile: ReturnType<typeof createFileRelocation>,
  playbackChoices: FilePlaybackChoicesApi,
  locationsChanged: () => void,
  automaticEnabled: (file: { work: WorkRef<FileWorkType>; id: string }) => void,
) {
  return {
    playbackChoices,
    async list<T extends FileWorkType>(raw: WorkRef<T>, input: unknown, range: unknown) {
      const work = fileWork(raw),
        query = parseFileQuery(work.type, input)
      let ids: string[] | null = null
      if (query.directoryId) {
        const dir = await call('readWorkDirectory', work, query.directoryId, sensitive())
        if (!dir) {
          throw new DesktopError('InvalidReference', 'The selected directory no longer exists')
        }
        ids = []
        for (const row of await call('libraryPositions', work)) {
          if (row.kind === 'directory') {
            continue
          }
          const relation = await registeredRelation(dir.path, row.path, native)
          if (relation === 'unknown') {
            throw new DesktopError('PathUnresolved', 'The directory membership cannot be verified')
          }
          if (relation === 'same' || relation === 'contains') {
            ids.push(row.id)
          }
        }
      }
      // The worker reads only the table selected by work.type.
      return call(
        'listWorkFiles',
        work,
        query,
        parseListOptions(range),
        sensitive(),
        ids,
      ) as unknown as Promise<ListResult<HeldFile<T>>>
    },
    get: <T extends FileWorkType>(raw: WorkRef<T>, id: string) =>
      call('readWorkFile', fileWork(raw), id, sensitive()) as Promise<HeldFile<T> | null>,
    async add(raw: unknown, input: unknown, options?: CallOptions) {
      const signal = callSignal(options)
      const work = fileWork(raw),
        value = parseFileCreateFields(work.type, input)
      const added = await register.file(work, value, signal)
      if (added.created && !value.associations) {
        await recognition.automatic(work, added.id, signal)
      }
      return added.id
    },
    async update(raw: unknown, id: string, input: unknown, options?: CallOptions) {
      const signal = callSignal(options)
      const fields = v.strictObject({ note: v.exactOptional(v.nullable(v.string())) })
      const result = v.safeParse(
        v.strictObject({ changes: fields, expected: v.exactOptional(fields) }),
        input,
      )
      if (
        !result.success ||
        (result.output.expected?.note !== undefined && result.output.changes.note === undefined)
      ) {
        throw new DesktopError('InvalidInput', 'Invalid file note edit')
      }
      signal.throwIfAborted()
      complete(
        await call(
          'changeFileNote',
          fileWork(raw),
          id,
          result.output.changes.note,
          result.output.expected?.note,
        ),
      )
    },
    async delete(raw: unknown, ids: readonly string[], options?: CallOptions) {
      const signal = callSignal(options)
      const work = fileWork(raw)
      signal.throwIfAborted()
      complete(
        await admit(
          ids.map((id) => ({ type: 'file', kind: work.type, id })),
          () => call('removeWorkFiles', work, ids),
        ),
      )
      locationsChanged()
    },
    async editAssociations(raw: unknown, id: string, input: unknown, options?: CallOptions) {
      const signal = callSignal(options)
      const work = fileWork(raw),
        edit = parseFileAssociationEdit(work.type, input)
      signal.throwIfAborted()
      if (!complete(await call('changeFileParts', work, id, edit, false))) {
        signal.throwIfAborted()
        complete(
          await admit([{ type: 'file', kind: work.type, id }], () =>
            call('changeFileParts', work, id, edit, true),
          ),
        )
      }
    },
    async setAssociationMode(raw: unknown, id: string, input: unknown, options?: CallOptions) {
      const { mode, expected } = parseFileAssociationModeChange(input),
        signal = callSignal(options)
      signal.throwIfAborted()
      const work = fileWork(raw)
      if (complete(await call('setFileMode', work, id, mode, expected?.associationMode))) {
        automaticEnabled({ work, id })
      }
    },
    async setPreferred(raw: unknown, input: unknown, options?: CallOptions) {
      const signal = callSignal(options)
      const work = fileWork(raw)
      const value = parsePreferredFileInput(work.type, input)
      signal.throwIfAborted()
      complete(await call('preferWorkFiles', work, [value]))
    },
    async setPreferredMany(raw: unknown, input: unknown, options?: CallOptions) {
      const signal = callSignal(options)
      const work = fileWork(raw)
      const values = parsePreferredPartFiles(work.type, input)
      signal.throwIfAborted()
      complete(
        await call(
          'preferWorkFiles',
          work,
          values.map(({ part, ...fields }) => ({ ...fields, scope: { type: 'part', part } })),
        ),
      )
    },
    testRecognition: <T extends FileWorkType>(
      raw: WorkRef<T>,
      id: string,
      input: unknown = {},
      options?: CallOptions,
    ) =>
      recognition.testRecognition(fileWork(raw), id, input, callSignal(options)) as Promise<
        FileRecognitionResult<T>
      >,
    reidentify: <T extends FileWorkType>(
      raw: WorkRef<T>,
      ids: readonly string[],
      options?: CallOptions,
    ) =>
      recognition.reidentify(fileWork(raw), ids, callSignal(options)) as unknown as Promise<
        FileReidentificationResult<T>
      >,
    relocate: <T extends FileWorkType>(
      raw: WorkRef<T>,
      id: string,
      input: unknown,
      options?: CallOptions,
    ) => {
      const parsed = v.safeParse(
        v.strictObject({
          path: v.string(),
          expected: v.exactOptional(v.strictObject({ path: v.string() })),
        }),
        input,
      )
      if (!parsed.success) {
        throw new DesktopError('InvalidInput', 'Choose the new file path')
      }
      return relocateFile(
        fileWork(raw),
        id,
        parsed.output.path,
        parsed.output.expected?.path,
        callSignal(options),
      ) as Promise<HoldingsRelocationResult<T>>
    },
    async merge(raw: unknown, input: unknown, options?: CallOptions) {
      const signal = callSignal(options)
      const work = fileWork(raw),
        value = parseFileMergeInput(input),
        path = normalizeAbsolutePath(value.path)
      const before = await call('libraryPositions', work)
      const pair = before.filter(
        (row) =>
          row.kind !== 'directory' &&
          (row.id === value.sourceFileId || row.id === value.targetFileId),
      )
      if (pair.length !== 2) {
        throw new DesktopError('NotFound', 'Choose two registered files of this work')
      }
      if (!pair.some((row) => row.path === path)) {
        throw new DesktopError('InvalidInput', 'Choose the location of one of the two records')
      }
      const facts = await inspectTarget(work.type, path, resources, signal)
      if (
        await existingPosition(
          before.filter((row) => !pair.includes(row)),
          work,
          { path, kind: facts.kind === 'directory' ? 'pages' : 'file' },
          native,
          signal,
        )
      ) {
        throw new DesktopError('PathConflict', 'A third file owns this location')
      }
      signal.throwIfAborted()
      const result = complete(
        await admit(
          pair.map((row) => ({ type: 'file', kind: work.type, id: row.id })),
          () => call('mergeWorkFiles', work, { ...value, path }, facts, before),
        ),
      )
      locationsChanged()
      return result
    },
    async information(raw: unknown, id: string, signal: AbortSignal) {
      const work = fileWork(raw)
      if (work.type !== 'anime') {
        throw new DesktopError('InvalidInput', 'Choose a video')
      }
      const file = await call('readWorkFile', work, id, sensitive())
      if (!file) {
        throw new DesktopError('NotFound', 'The video is unavailable')
      }
      const value = await inspectVideo(resources, file.path, signal)
      signal.throwIfAborted()
      complete(
        await call(
          'checkWorkFile',
          work,
          id,
          file.path,
          { status: 'accessible', checkedAt: Date.now() },
          { kind: 'file', video: value.metadata },
        ),
      )
      return value
    },
  }
}
