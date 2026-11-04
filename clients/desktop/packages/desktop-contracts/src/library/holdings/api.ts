/** @fileoverview Composes local holdings, discovery, usage preferences and backup operations. */

import type { ContentDirectoriesApi } from './directories'
import type { HeldFilesApi } from './files'
import type { GameLaunchConfigsApi } from './game-configuration'
import type { GameBackupsApi } from './backups/api'
import type { HoldingsPreferencesApi } from './preferences'
import type { FileRecognitionProfilesApi } from './file-recognition'
import type { FileWorkType, WorkRef, EntryRef } from '../catalog'

import type {
  LocalContentInput,
  LocalContentRegistrationOptions,
  LocalContentRegistrationResult,
  HoldingsRefreshResult,
} from './local-content'
import type { CallOptions } from '../../operations'

/** Four-work registration, media maintenance and game backup are separate capabilities, sharing stable local identities. */
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

  registerLocalContent(
    work: WorkRef,
    input: LocalContentInput,
    options?: LocalContentRegistrationOptions,
    call?: CallOptions,
  ): Promise<LocalContentRegistrationResult>
  refresh<T extends FileWorkType>(
    work: EntryRef<T>,
    call?: CallOptions,
  ): Promise<HoldingsRefreshResult<T>>
}
