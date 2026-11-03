/** @fileoverview Defines real local directories, files, explicit associations and separate maintenance facts. */

import type { ErrorSummary } from '../errors'
import type { NonEmptyArray, StoredDefinition } from '../operations'
import type { PathFilter } from '../paths'
import type {
  AnimePlaybackPreferences,
  PlaybackOverrideChange,
  ReadingOverrideChange,
  ReadingPreferences,
  UsageOverride,
} from '../preferences/usage'
import type { EntryRef, ExternalIdentity, PartRef, WorkRef, WorkType } from './catalog'
import type { FileConditionByType } from './file-recognition-output'
import type { FileWorkType } from './file-recognition'
import type { ReadingPosition, TextEncoding } from './reading'

/** Discovery settings control new paths only; they do not remove existing files or choose a naming profile. */
export interface DirectoryDiscoveryDefinition {
  readonly maxDepth: number | null
  readonly include: readonly PathFilter[]
  readonly exclude: readonly PathFilter[]
}

export type ContentDirectory<T extends WorkType = WorkType> = {
  [K in T]: {
    readonly id: string
    readonly work: EntryRef<K>
    readonly path: string
    readonly createdAt: number
    readonly updatedAt: number
  } & (K extends FileWorkType
    ? {
        readonly definition: StoredDefinition<DirectoryDiscoveryDefinition>
        readonly recognitionProfileId: string | null
      }
    : object)
}[T]

export type DirectoryCreateFields<T extends WorkType = WorkType> = {
  [K in T]: { readonly path: string } & (K extends FileWorkType
    ? {
        readonly definition?: DirectoryDiscoveryDefinition
        readonly recognitionProfileId?: string | null
      }
    : object)
}[T]

/** Discovery/profile edits do not relocate paths. A path change with related mappings uses the explicit relocation operation. */
export interface DirectoryUpdate {
  readonly changes: {
    readonly definition?: DirectoryDiscoveryDefinition
    readonly recognitionProfileId?: string | null
  }
  readonly expected?: {
    readonly definition?: DirectoryDiscoveryDefinition
    readonly recognitionProfileId?: string | null
  }
}

/** Persistent permission for later automatic association, independent of current association contents. */
export type FileAssociationMode = 'automatic' | 'manual'

export type FilePartType<T extends FileWorkType> = {
  readonly anime: 'animeEpisode' | 'animeExtra'
  readonly comic: 'comicVolume' | 'comicChapter'
  readonly novel: 'novelVolume'
}[T]

export interface FileAssociation<T extends FileWorkType = FileWorkType> {
  readonly part: PartRef<FilePartType<T>>
  readonly isPreferred: boolean
}

export interface FileAssociationInput<T extends FileWorkType = FileWorkType> {
  readonly part: PartRef<FilePartType<T>>
  readonly isPreferred?: boolean
}

/** Associations form one complete direct set; comic volume membership does not imply direct chapter associations. */
export type FileAssociationChange<T extends FileWorkType = FileWorkType> =
  | { readonly type: 'replace'; readonly items: readonly FileAssociationInput<T>[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly FileAssociationInput<T>[]
      readonly remove?: readonly PartRef<FilePartType<T>>[]
    }

export interface FileAssociationEdit<T extends FileWorkType = FileWorkType> {
  readonly change: FileAssociationChange<T>
  readonly expected?: {
    readonly associations: readonly FileAssociation<T>[]
    readonly associationMode: FileAssociationMode
  }
}

/** Unknown, positively accessible and known unavailable observations never collapse into the same state. */
export type FileAvailability =
  | { readonly status: 'unchecked' }
  | { readonly status: 'accessible'; readonly checkedAt: number }
  | {
      readonly status: 'unavailable'
      readonly checkedAt: number
      readonly reason: 'missing' | 'unreadable'
      readonly error: ErrorSummary
    }

export interface AnimeFileMetadata {
  readonly container: string
  readonly durationSeconds: number | null
  readonly width: number | null
  readonly height: number | null
}

export interface ReadingFileMetadata {
  readonly format: 'epub' | 'mobi' | 'fb2' | 'txt' | 'pdf' | 'images'
  readonly pageCount: number | null
}

export type FileTrackSelection =
  | { readonly type: 'embedded'; readonly index: number }
  | { readonly type: 'external'; readonly path: string; readonly index: number }

/** Persistent source-track choices and signed second offsets are separate from runtime opaque track IDs. */
export interface FilePlaybackChoices {
  readonly audioTrack: FileTrackSelection | null
  readonly subtitleTrack: FileTrackSelection | null
  readonly audioDelaySeconds: number
  readonly subtitleDelaySeconds: number
}

export interface FilePreferencesByType {
  readonly anime: AnimePlaybackPreferences
  readonly comic: ReadingPreferences
  readonly novel: ReadingPreferences
}

export interface FilePreferenceChangeByType {
  readonly anime: PlaybackOverrideChange
  readonly comic: ReadingOverrideChange
  readonly novel: ReadingOverrideChange
}

/** A corrupt association-mode field disables adoption while the file and other readable facts remain visible. */
type FileAssociationState =
  | { readonly associationMode: FileAssociationMode; readonly associationError: null }
  | { readonly associationMode: null; readonly associationError: ErrorSummary }

export type HeldFile<T extends FileWorkType = FileWorkType> = {
  [K in T]: {
    readonly id: string
    readonly work: EntryRef<K>
    readonly path: string

    readonly note: string | null
    readonly isPreferred: boolean
    readonly associations: readonly FileAssociation<K>[]

    readonly availability: FileAvailability
    readonly preferences: StoredDefinition<UsageOverride<FilePreferencesByType[K]>> | null
    readonly createdAt: number
    readonly updatedAt: number
  } & FileAssociationState &
    (K extends 'anime'
      ? {
          readonly kind: 'file'
          readonly metadata: StoredDefinition<AnimeFileMetadata> | null
          readonly position: StoredDefinition<number> | null
          readonly playbackChoices: StoredDefinition<FilePlaybackChoices>
        }
      : {
          readonly kind: 'file' | 'directory'
          readonly metadata: StoredDefinition<ReadingFileMetadata> | null
          readonly position: StoredDefinition<ReadingPosition> | null
          readonly progress: number | null
          readonly textEncoding: TextEncoding | null
        })
}[T]

/** Explicit associations, including [], begin in manual mode; omitted associations permit ordinary automatic matching. */
export interface FileCreateFields<T extends FileWorkType = FileWorkType> {
  readonly path: string
  readonly note?: string | null
  readonly associations?: readonly FileAssociationInput<T>[]
  readonly isPreferred?: boolean
}

/** List predicates use saved observations; list never probes a disk or starts content. */
export interface FileQuery<T extends FileWorkType = FileWorkType> {
  readonly search: string
  readonly directoryId?: string
  readonly part?: PartRef<FilePartType<T>>
  readonly association?: 'associated' | 'unassociated'
  readonly associationMode?: FileAssociationMode
  readonly availability?: FileAvailability['status']
}

export type PreferredFileScope<T extends FileWorkType = FileWorkType> =
  { readonly type: 'work' } | { readonly type: 'part'; readonly part: PartRef<FilePartType<T>> }

export interface PreferredFileInput<T extends FileWorkType = FileWorkType> {
  readonly scope: PreferredFileScope<T>
  readonly fileId: string | null
  readonly expected?: { readonly preferredFileId: string | null }
}

export interface PreferredPartFile<T extends FileWorkType = FileWorkType> {
  readonly part: PartRef<FilePartType<T>>
  readonly fileId: string | null
  readonly expected?: { readonly preferredFileId: string | null }
}

/** Register one known work's real input; a file input never implicitly registers its parent directory. */
export interface LocalContentInput {
  readonly type: 'directory' | 'file'
  readonly path: string
}

export interface LocalContentRegistrationOptions {
  readonly expectedIdentities?: NonEmptyArray<ExternalIdentity>
}

export interface LocalContentRegistrationResult {
  readonly work: WorkRef
  readonly registrations: NonEmptyArray<{
    readonly type: 'directory' | 'file' | 'launchConfig'
    readonly id: string
    readonly outcome: 'registered' | 'alreadyRegistered'
  }>
  readonly issues: readonly (
    | { readonly code: 'initialRefreshFailed'; readonly error: ErrorSummary }
    | { readonly code: 'launchConfigIncomplete'; readonly launchConfigId: string }
  )[]
}

/** A recognition source is one complete interpretation, never a mixture of builtin and custom fields. */
export type FileRecognitionSource =
  | { readonly type: 'builtin' }
  | { readonly type: 'profile'; readonly profileId: string; readonly ruleId: string }

export type FileRecognitionResult<T extends FileWorkType = FileWorkType> =
  | {
      readonly outcome: 'matched'
      readonly source: FileRecognitionSource
      readonly conditions: NonEmptyArray<FileConditionByType[T]>
      readonly parts: NonEmptyArray<PartRef<FilePartType<T>>>
    }
  | { readonly outcome: 'unmatched' }
  | {
      readonly outcome: 'failed'
      readonly source: FileRecognitionSource | null
      readonly reason:
        | 'invalidOutput'
        | 'targetMissing'
        | 'ambiguousTarget'
        | 'conflictingInterpretation'
        | 'invalidConfiguration'
        | 'unreadable'
      readonly error: ErrorSummary
    }

/** Results report actual per-file outcomes; unavailable files and invalid matching do not erase already held data. */
export interface HoldingsRefreshResult<T extends FileWorkType = FileWorkType> {
  readonly work: EntryRef<T>

  readonly discovery: {
    readonly finished: boolean
    readonly registeredFileIds: readonly string[]
    readonly issues: readonly { readonly path: string; readonly error: ErrorSummary }[]
  }

  readonly files: readonly {
    readonly fileId: string
    readonly availability: FileAvailability
    readonly recognition: FileRecognitionResult<T> | null
    readonly associationOutcome: 'updated' | 'unchanged' | 'notAttempted' | 'waitingForUse'
  }[]
}

export interface FileReidentificationResult<T extends FileWorkType = FileWorkType> {
  readonly work: EntryRef<T>
  readonly files: readonly {
    readonly fileId: string
    readonly result: FileRecognitionResult<T>
    readonly changed: boolean
  }[]
}

/** Only explicitly named stored path fields may accompany directory relocation; commands and historical text are excluded. */
export interface DirectoryRelocationInput {
  readonly path: string
  readonly expected?: { readonly path: string }

  readonly gameConfigFields?: readonly {
    readonly launchConfigId: string
    readonly fields: NonEmptyArray<'launchPath' | 'workingDirectory' | 'monitorPath' | 'savePath'>
  }[]

  readonly subtitlePaths?: readonly {
    readonly fileId: string
    readonly paths: NonEmptyArray<string>
  }[]
}

export type RelocatedPathTarget =
  | { readonly type: 'directory' | 'file'; readonly id: string }
  | {
      readonly type: 'launchConfig'
      readonly id: string
      readonly field: 'launchPath' | 'workingDirectory' | 'monitorPath' | 'savePath'
    }
  | { readonly type: 'subtitle'; readonly fileId: string; readonly path: string }

export interface HoldingsRelocationResult {
  readonly work: WorkRef

  readonly updated: readonly {
    readonly target: RelocatedPathTarget
    readonly from: string
    readonly to: string
  }[]

  readonly issues: readonly {
    readonly target: RelocatedPathTarget
    readonly path: string
    readonly status: 'unverified' | 'unavailable' | 'conflict'
    readonly error: ErrorSummary
  }[]
}

export interface FileMergeInput {
  readonly sourceFileId: string
  readonly targetFileId: string
  readonly path: string
}

export interface FileMergeResult {
  readonly fileId: string
  readonly removedFileId: string
  readonly path: string
}
