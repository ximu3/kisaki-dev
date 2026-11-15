/** @fileoverview Composes local holdings, discovery, usage preferences and backup operations. */

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

/**
 * Local-content registration, file maintenance, usage preferences and game backup capabilities.
 *
 * These operations share stable holdings identities while retaining their own execution boundaries.
 */
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
   * Registers actual local input for a fixed work and rechecks any identity precondition before
   * commit.
   *
   * An initial refresh can fail after registration succeeds. The result reports both outcomes.
   */
  registerLocalContent<T extends WorkType>(
    work: WorkRef<T>,
    input: LocalContentInput,
    options?: LocalContentRegistrationOptions,
    call?: CallOptions,
  ): Promise<LocalContentRegistrationResult<T>>

  /**
   * Completes discovery and maintenance while preserving held data and manual associations.
   *
   * Reports each file's availability and which changes were applied.
   */
  refresh<T extends FileWorkType>(
    work: EntryRef<T>,
    call?: CallOptions,
  ): Promise<HoldingsRefreshResult<T>>
}
