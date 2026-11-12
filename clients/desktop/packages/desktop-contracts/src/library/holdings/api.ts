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
   * Initial-refresh issues are reported separately from established registrations.
   */
  registerLocalContent(
    work: WorkRef,
    input: LocalContentInput,
    options?: LocalContentRegistrationOptions,
    call?: CallOptions,
  ): Promise<LocalContentRegistrationResult>

  /**
   * Completes discovery and maintenance while preserving held data and manual associations.
   *
   * Reports actual per-file availability and adoption outcomes.
   */
  refresh<T extends FileWorkType>(
    work: EntryRef<T>,
    call?: CallOptions,
  ): Promise<HoldingsRefreshResult<T>>
}
