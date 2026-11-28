import type {
  FileWorkType,
  WorkRef,
  HoldingsRefreshResult,
} from '@kisaki3/desktop-contracts/library'
import type { Translate } from '@kisaki3/desktop-localization'
import type { PreferencesSnapshot } from '@kisaki3/desktop-contracts/preferences'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import type { NativeFiles } from '#native'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import { createSignal } from '../../../infrastructure/events'
import type { ChangeAdmission } from '../change-admission'
import type { CompleteWrite } from '../transaction'
import { localContentRegistration } from './registration'
import { createRegistration } from './registration/queue'
import { createPlaybackChoices } from './anime/playback-choices'
import { createRecognition } from './recognition'
import { createProfiles } from './recognition/profiles'
import type { recognitionStorage } from './recognition/storage'
import { createLaunchConfigs } from './game/configuration'
import type { launchConfigStorage } from './game/configuration/storage'
import { watchHoldings } from './maintenance/watch'
import { createRefresh } from './maintenance/refresh'
import { createFileRelocation } from './files/relocate'
import { createDirectoryRelocation, type relocationStorage } from './directories/relocate'
import type { holdingStorage } from './storage'
import { fileWork, callSignal } from './work'
import { createFiles } from './files'
import { createDirectories } from './directories'
import { holdingPreferences, type preferenceStorage } from './preferences'
import { profileCatalog } from './recognition/catalog'

export { fileWork } from './work'

type Operations = ReturnType<typeof preferenceStorage> &
  ReturnType<typeof holdingStorage> &
  ReturnType<typeof launchConfigStorage> &
  ReturnType<typeof recognitionStorage> &
  ReturnType<typeof relocationStorage>
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
  const register = createRegistration(call, complete, native, resources, admit, locations.emit)
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
  const { preferences, inherited } = holdingPreferences(call, complete, usage)
  const playbackChoices = createPlaybackChoices(call, complete)
  const relocateDirectory = createDirectoryRelocation(
    call,
    complete,
    native,
    resources,
    admit,
    locations.emit,
  )
  const launchConfigs = createLaunchConfigs(call, complete, sensitive, admit)
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
    registerLocalContent: localContentRegistration(register, refresh, recognition),
  }
}
