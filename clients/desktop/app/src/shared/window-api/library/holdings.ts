import type {
  ContentDirectory,
  DirectoryUpdate,
  DirectoryDiscoveryDefinition,
  DirectoryRelocationInput,
  HoldingsRelocationResult,
  HoldingsRefreshResult,
  FileQuery,
  HeldFile,
  FileCreateFields,
  FileAssociationEdit,
  PreferredFileInput,
  PreferredPartFile,
  FileMergeInput,
  FileMergeResult,
  FileWorkType,
  WorkRef,
  FileRecognitionDefinition,
  FileRecognitionResult,
  FileReidentificationResult,
  FileRecognitionSource,
  FileConditionByType,
  FileRecognitionPreset,
  FileRecognitionProfile,
  FileRecognitionProfileFields,
  GameLaunchConfig,
  GameLaunchConfigCreate,
  GameLaunchConfigUpdate,
  ReorderInput,
  LocalContentRegistrationResult,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions, ListResult } from '@kisaki3/desktop-contracts/operations'
import type { ErrorSummary } from '@kisaki3/desktop-contracts/errors'
import type { VideoInformation } from '../../media-information'

import type {
  FilePreferenceChangeByType,
  FilePreferencesByType,
  UsagePreferenceTarget,
  FilePlaybackChoices,
} from '@kisaki3/desktop-contracts/library'
import type { UsageOverride } from '@kisaki3/desktop-contracts/preferences'
import type { StoredValue } from '@kisaki3/desktop-contracts/operations'
export interface HoldingsWindowApi {
  'library.holdings.preferences'(
    work: WorkRef<FileWorkType>,
    target: UsagePreferenceTarget,
  ): {
    saved: StoredValue<UsageOverride<FilePreferencesByType[FileWorkType]>> | null
    inherited: FilePreferencesByType[FileWorkType]
  }
  'library.holdings.updatePreferences'(
    work: WorkRef<FileWorkType>,
    target: UsagePreferenceTarget,
    input: FilePreferenceChangeByType[FileWorkType],
  ): void
  'library.files.playbackChoices'(
    anime: string,
    file: string,
    input: { changes: Partial<FilePlaybackChoices>; expected?: Partial<FilePlaybackChoices> },
  ): void
  'library.holdings.choosePath'(kind: 'file' | 'directory'): string | null
  'library.holdings.register'(
    work: WorkRef,
    input: { type: 'file' | 'directory'; path: string },
  ): LocalContentRegistrationResult
  'library.holdings.directories'(work: WorkRef): readonly ContentDirectory[]
  'library.holdings.updateDirectory'(
    work: WorkRef<FileWorkType>,
    id: string,
    input: DirectoryUpdate,
  ): void
  'library.holdings.removeDirectory'(work: WorkRef, id: string): void
  'library.holdings.openDirectory'(work: WorkRef, id: string): void
  'library.holdings.relocateDirectory'(
    work: WorkRef,
    id: string,
    input: DirectoryRelocationInput,
  ): HoldingsRelocationResult
  'library.holdings.previewDirectory'(
    work: WorkRef<FileWorkType>,
    id: string,
    definition: DirectoryDiscoveryDefinition,
    profileId: string | null,
  ): {
    items: readonly { path: string; registered: boolean; result: FileRecognitionResult | null }[]
    skipped: readonly string[]
    issues: readonly { path: string; error: ErrorSummary }[]
  }
  'library.holdings.refresh'(work: WorkRef<FileWorkType>): HoldingsRefreshResult
  'library.files.list'(
    work: WorkRef<FileWorkType>,
    query: FileQuery,
    range: ListOptions,
  ): ListResult<HeldFile>
  'library.files.get'(work: WorkRef<FileWorkType>, id: string): HeldFile | null
  'library.files.add'(work: WorkRef<FileWorkType>, input: FileCreateFields): string
  'library.files.update'(
    work: WorkRef<FileWorkType>,
    id: string,
    input: { changes: { note?: string | null }; expected?: { note?: string | null } },
  ): void
  'library.files.remove'(work: WorkRef<FileWorkType>, ids: readonly string[]): void
  'library.files.reveal'(work: WorkRef<FileWorkType>, id: string): void
  'library.files.relocate'(
    work: WorkRef<FileWorkType>,
    id: string,
    path: string,
    expected: string,
  ): HoldingsRelocationResult<FileWorkType>
  'library.files.merge'(work: WorkRef<FileWorkType>, input: FileMergeInput): FileMergeResult
  'library.files.associations'(
    work: WorkRef<FileWorkType>,
    id: string,
    input: FileAssociationEdit,
  ): void
  'library.files.setMode'(
    work: WorkRef<FileWorkType>,
    id: string,
    mode: 'manual' | 'automatic',
    expected: 'manual' | 'automatic',
  ): void
  'library.files.setPreferred'(work: WorkRef<FileWorkType>, input: PreferredFileInput): void
  'library.files.setPreferredMany'(
    work: WorkRef<FileWorkType>,
    input: readonly PreferredPartFile[],
  ): void
  'library.files.inspectVideo'(work: WorkRef<'anime'>, id: string): VideoInformation
  'library.files.testRecognition'(
    work: WorkRef<FileWorkType>,
    id: string,
    input: { definition?: FileRecognitionDefinition },
  ): FileRecognitionResult
  'library.files.reidentify'(
    work: WorkRef<FileWorkType>,
    ids: readonly string[],
  ): FileReidentificationResult
  'library.profiles.explain'(
    type: FileWorkType,
    definition: FileRecognitionDefinition,
    baseName: string,
    path: string | null,
  ): {
    source: FileRecognitionSource | null
    input: string
    numbers: readonly { input: string; offset: number; value: string }[]
    captures: Readonly<Record<string, string>>
    conditions: readonly FileConditionByType[FileWorkType][]
  }
  'library.profiles.list'(
    type: FileWorkType,
  ): readonly Pick<FileRecognitionProfile, 'id' | 'name' | 'workType' | 'description'>[]
  'library.profiles.get'(type: FileWorkType, id: string): FileRecognitionProfile | null
  'library.profiles.references'(
    type: FileWorkType,
    id: string,
  ): readonly { work: WorkRef<FileWorkType>; directoryId: string; path: string }[]
  'library.profiles.presets'(type: FileWorkType): readonly FileRecognitionPreset<FileWorkType>[]
  'library.profiles.create'(
    type: FileWorkType,
    input: FileRecognitionProfileFields<FileWorkType>,
  ): FileRecognitionProfile
  'library.profiles.update'(
    type: FileWorkType,
    id: string,
    input: {
      changes: Partial<FileRecognitionProfileFields<FileWorkType>>
      expected?: Partial<FileRecognitionProfileFields<FileWorkType>>
    },
  ): FileRecognitionProfile
  'library.profiles.delete'(type: FileWorkType, id: string): void
  'library.profiles.reorder'(type: FileWorkType, input: ReorderInput): void
  'library.configs.openLocation'(game: string, id: string): void
  'library.configs.list'(game: string): readonly GameLaunchConfig[]
  'library.configs.get'(game: string, id: string): GameLaunchConfig | null
  'library.configs.create'(game: string, input: GameLaunchConfigCreate): string
  'library.configs.update'(game: string, id: string, input: GameLaunchConfigUpdate): void
  'library.configs.delete'(game: string, id: string): void
  'library.configs.reorder'(game: string, input: ReorderInput): void
  'library.configs.prefer'(game: string, id: string | null, expected: string | null): void
}
