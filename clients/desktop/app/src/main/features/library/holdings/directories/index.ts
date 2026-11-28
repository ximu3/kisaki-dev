import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseWorkRef,
  type WorkRef,
  type WorkType,
  type ContentDirectory,
  type ContentDirectoriesApi,
  type HoldingsRelocationResult,
  parseDirectoryCreateFields,
  parseDirectoryUpdate,
  parseDirectoryDiscoveryDefinition,
} from '@kisaki3/desktop-contracts/library'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import type { NativeFiles } from '#native'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import type { CompleteWrite } from '../../transaction'
import { fileWork, callSignal } from '../work'
import type { registration } from '../registration'
import type { createRefresh } from '../refresh'
import type { createRecognition } from '../recognition'
import type { createProfiles } from '../recognition/profiles'
import type { createDirectoryRelocation } from './relocate'
import { discover } from '../discover'
import type { holdingStorage } from '../storage'
export function createDirectories(
  call: DatabaseCall<ReturnType<typeof holdingStorage>>,
  native: NativeFiles,
  sensitive: () => boolean,
  complete: CompleteWrite,
  register: ReturnType<typeof registration>,
  refresh: ReturnType<typeof createRefresh>,
  recognition: ReturnType<typeof createRecognition>,
  profiles: ReturnType<typeof createProfiles>,
  relocateDirectory: ReturnType<typeof createDirectoryRelocation>,
  locationsChanged: () => void,
) {
  return {
    relocate: <Args extends Parameters<ContentDirectoriesApi['relocate']>>(
      ...[work, id, input, options]: Args
    ) =>
      relocateDirectory(work, id, input, callSignal(options)) as Promise<
        HoldingsRelocationResult<Args[0]['type']>
      >,
    async preview(
      raw: unknown,
      id: string,
      input: unknown,
      profile: string | null,
      signal: AbortSignal,
    ) {
      const work = fileWork(raw),
        definition = parseDirectoryDiscoveryDefinition(input)
      const root = await call('readWorkDirectory', work, id, sensitive())
      if (!root) {
        throw new DesktopError('NotFound', 'The directory is unavailable')
      }
      const saved = profile ? await profiles.get(work.type, profile) : null
      if (profile && saved?.definition.status !== 'ready') {
        throw new DesktopError('InvalidReference', 'The chosen recognition profile is unavailable')
      }
      const before = await call('libraryPositions', work)
      const found = await discover(
        work.type,
        root.path,
        definition,
        before,
        await call('recoveryPaths'),
        native,
        signal,
      )
      const items = await recognition.preview(
        work,
        root.path,
        found.paths,
        before,
        saved?.definition.status === 'ready'
          ? { id: saved.id, definition: saved.definition.value }
          : null,
        signal,
      )
      return { items, skipped: found.skipped, issues: found.issues }
    },
    list: <T extends WorkType>(raw: WorkRef<T>) =>
      call('listWorkDirectories', parseWorkRef(raw), sensitive()) as Promise<
        readonly ContentDirectory<T>[]
      >,
    get: <T extends WorkType>(raw: WorkRef<T>, id: string) =>
      call(
        'readWorkDirectory',
        parseWorkRef(raw),
        id,
        sensitive(),
      ) as Promise<ContentDirectory<T> | null>,
    async create(raw: unknown, input: unknown, options?: CallOptions) {
      const signal = callSignal(options)
      const work = parseWorkRef(raw)
      const saved = await register.directory(
        work,
        parseDirectoryCreateFields(work.type, input),
        signal,
      )
      if (saved.created && work.type !== 'game') {
        await refresh({ id: work.id, type: work.type }, signal)
      }
      return saved.id
    },
    async update(raw: unknown, id: string, input: unknown, options?: CallOptions) {
      const signal = callSignal(options)
      const work = parseWorkRef(raw),
        update = parseDirectoryUpdate(input)
      signal.throwIfAborted()
      complete(await call('editWorkDirectory', work, id, update))
      locationsChanged()
    },
    async delete(raw: unknown, id: string, options?: CallOptions) {
      const signal = callSignal(options)
      signal.throwIfAborted()
      complete(await call('forgetDirectory', parseWorkRef(raw), id))
      locationsChanged()
    },
  }
}
