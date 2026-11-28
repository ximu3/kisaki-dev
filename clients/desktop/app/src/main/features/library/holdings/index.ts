import { DesktopError, type ErrorSummary } from '@kisaki3/desktop-contracts/errors'
import {
  parseWorkRef,
  parseLocalContentInput,
  parseLocalContentRegistrationOptions,
  type FileWorkType,
  type WorkType,
  type WorkRef,
  type HoldingsRefreshResult,
  type LocalContentRegistrationResult,
} from '@kisaki3/desktop-contracts/library'
import type { Translate } from '@kisaki3/desktop-localization'
import type { NativeFiles } from '#native'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import { createSignal } from '../../../infrastructure/events'
import type { ChangeAdmission } from '../../../infrastructure/use-targets'
import type { CompleteWrite } from '../transaction'
import { createRecognition } from './recognition'
import { createProfiles } from './recognition/profiles'
import type { recognitionStorage } from './recognition/storage'
import { createGameConfigs } from './game'
import type { configStorage } from './game/configurations'
import { registration } from './registration'
import { watchHoldings } from './watch'
import { createRefresh } from './refresh'
import { createFileRelocation } from './files/relocate'
import { createDirectoryRelocation, type relocationStorage } from './directories/relocate'
import { fileError } from './discover'
import type { holdingStorage } from './storage'

import { fileWork, callSignal } from './work'
export { fileWork } from './work'
import { createFiles } from './files'
import { createDirectories } from './directories'
import { holdingPreferences, type preferenceStorage } from './preferences'
import type { PreferencesSnapshot } from '@kisaki3/desktop-contracts/preferences'

type Operations = ReturnType<typeof preferenceStorage> &
  ReturnType<typeof holdingStorage> &
  ReturnType<typeof configStorage> &
  ReturnType<typeof recognitionStorage> &
  ReturnType<typeof relocationStorage>
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import { profileCatalog } from './recognition/catalog'
export function createHoldings(
  call: DatabaseCall<Operations>,
  complete: CompleteWrite,
  native: NativeFiles,
  resources: string,
  worker: URL,
  admit: ChangeAdmission,
  sensitive: () => boolean,
  language: () => Translate,
  usage: () => PreferencesSnapshot['usage'],
  invalidate: () => void,
) {
  const automatic = createSignal<{ work: WorkRef<FileWorkType>; id: string }>()
  const locations = createSignal<void>(),
    rulesChanged = createSignal<{ type: FileWorkType; id: string | null; definition: boolean }>()
  const register = registration(call, complete, native, resources, admit, locations.emit)
  const recognition = createRecognition(call, native, complete, admit, worker)
  const profiles = createProfiles(call, worker, language, (type, id, definition) => {
    rulesChanged.emit({ type, id, definition })
    invalidate()
  })
  const refresh = createRefresh(call, complete, native, resources, register, recognition)
  const relocateFile = createFileRelocation(
    call,
    complete,
    native,
    resources,
    admit,
    locations.emit,
  )
  const { preferences, playbackChoices, inherited } = holdingPreferences(call, complete, usage)
  const relocateDirectory = createDirectoryRelocation(
    call,
    complete,
    native,
    resources,
    admit,
    locations.emit,
  )
  const launchConfigs = createGameConfigs(call, complete, sensitive, admit)
  return {
    watch: (report: (cause: unknown) => void) =>
      watchHoldings(() => call('watchTargets'), refresh, recognition, native, report),
    onLocationsChanged: locations.on,
    onAutomaticEnabled: automatic.on,
    locationsChanged: locations.emit,
    onRulesChanged: rulesChanged.on,
    refresh: <T extends FileWorkType>(raw: WorkRef<T>, options?: CallOptions) =>
      refresh(fileWork(raw), callSignal(options)) as Promise<HoldingsRefreshResult<T>>,
    reconcile: refresh,
    recognition,
    preferences,
    inherited,
    profiles,
    recognitionProfiles: {
      anime: profileCatalog('anime', profiles),
      comic: profileCatalog('comic', profiles),
      novel: profileCatalog('novel', profiles),
    },
    launchConfigs,
    directories: createDirectories(
      call,
      native,
      sensitive,
      complete,
      register,
      refresh,
      recognition,
      profiles,
      relocateDirectory,
      locations.emit,
    ),
    files: createFiles(
      call,
      native,
      resources,
      sensitive,
      complete,
      admit,
      register,
      recognition,
      relocateFile,
      playbackChoices,
      locations.emit,
      automatic.emit,
    ),
    async registerLocalContent<T extends WorkType>(
      raw: WorkRef<T>,
      input: unknown,
      options: unknown = {},
      context?: CallOptions,
    ): Promise<LocalContentRegistrationResult<T>> {
      const signal = callSignal(context)
      const work = parseWorkRef(raw),
        value = parseLocalContentInput(input),
        { expectedIdentities } = parseLocalContentRegistrationOptions(options ?? {})
      if (work.type === 'game' && value.type === 'file') {
        return register.game(
          { type: 'game', id: work.id },
          value.path,
          signal,
          expectedIdentities,
        ) as Promise<LocalContentRegistrationResult<T>>
      }
      const saved =
        value.type === 'directory'
          ? await register.directory(work, { path: value.path }, signal, expectedIdentities)
          : await register.file(fileWork(work), { path: value.path }, signal, expectedIdentities)
      const issues: { code: 'initialRefreshFailed'; error: ErrorSummary }[] = []
      const result = {
        work,
        registrations: [
          {
            type: value.type,
            id: saved.id,
            outcome: saved.created ? 'registered' : 'alreadyRegistered',
          },
        ],
        issues,
      } as LocalContentRegistrationResult
      if (saved.created && work.type !== 'game') {
        const target = { type: work.type, id: work.id }
        try {
          if (value.type === 'directory') {
            const report = await refresh(target, signal)
            for (const issue of report.discovery.issues) {
              issues.push({ code: 'initialRefreshFailed', error: issue.error })
            }
          } else {
            const report = await recognition.automatic(target, saved.id, signal)
            if (report.recognition?.outcome === 'failed') {
              issues.push({ code: 'initialRefreshFailed', error: report.recognition.error })
            }
          }
        } catch (cause) {
          if (signal.aborted) {
            throw new DesktopError('Cancelled', 'Initial content checking was cancelled', {
              cause,
              partialResult: result,
            })
          }
          issues.push({ code: 'initialRefreshFailed', error: fileError(cause) })
        }
      }
      return result as LocalContentRegistrationResult<T>
    },
  }
}
