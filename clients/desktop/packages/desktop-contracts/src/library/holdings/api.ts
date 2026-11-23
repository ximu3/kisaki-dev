import type { ContentDirectoriesApi } from './directories'
import type { HeldFilesApi } from './files'
import type { GameLaunchConfigsApi } from './game-configuration'
import type { GameBackupsApi } from './backups/api'
import type { HoldingsPreferencesApi } from './preferences'
import type { FileRecognitionProfilesApi } from './file-recognition'
import type { FileWorkType, WorkRef, WorkType, EntryRef } from '../catalog'

import type {
  LocalContentInput,
  LocalContentRegistrationOptions,
  LocalContentRegistrationResult,
  HoldingsRefreshResult,
} from './local-content'
import type { CallOptions } from '../../operations'

export interface HoldingsApi {
  readonly directories: ContentDirectoriesApi
  readonly files: HeldFilesApi
  readonly launchConfigs: GameLaunchConfigsApi
  readonly backups: GameBackupsApi
  readonly preferences: HoldingsPreferencesApi
  readonly recognitionProfiles: {
    readonly anime: FileRecognitionProfilesApi<'anime'>
    readonly comic: FileRecognitionProfilesApi<'comic'>
    readonly novel: FileRecognitionProfilesApi<'novel'>
  }

  /**
   * The work stays fixed through the identity recheck and commit. An initial refresh can fail after
   * registration succeeds. Both outcomes are returned.
   */
  registerLocalContent<T extends WorkType>(
    work: WorkRef<T>,
    input: LocalContentInput,
    options?: LocalContentRegistrationOptions,
    call?: CallOptions,
  ): Promise<LocalContentRegistrationResult<T>>

  /**
   * Reports availability and applied changes per file. Discovered facts preserve held data and
   * manual associations.
   */
  refresh<T extends FileWorkType>(
    work: EntryRef<T>,
    call?: CallOptions,
  ): Promise<HoldingsRefreshResult<T>>
}
