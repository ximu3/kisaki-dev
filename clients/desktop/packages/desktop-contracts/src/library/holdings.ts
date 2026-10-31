/** @fileoverview Defines real local directories, files, associations, and complete maintenance operations. */

import * as v from 'valibot'
import type { DefinitionRead } from '../definition'
import type { ErrorSummary } from '../errors'
import type { CallOptions, Disposable, ListOptions, ListResult } from '../execution'
import { absolutePathSchema, pathFilterSchema, type PathFilter } from '../paths'
import type {
  AnimePlaybackPreferences,
  ReadingPreferences,
  ReadingPreferenceChanges,
} from '../preferences'
import { objectSchema } from '../schema'
import {
  exactPartialEntries,
  hasRelatedExpected,
  nonnegativeIntegerSchema,
  parseContract,
} from '../validation'
import type { GameBackupsApi } from './backups'
import type { FileRecognitionProfilesApi, FileWorkType } from './file-recognition'
import type { EntryRef, ExternalIdentity, PartRef, WorkRef, WorkType } from './identity'
import type { GameLaunchConfigsApi } from './launch-configs'
import type { OrderChange } from './ordering'
import type { ReadingPosition, TextEncoding } from './reading'

/** Discovery affects new candidates only; existing registered files retain independent maintenance. */
export interface DirectoryDiscoveryDefinition {
  readonly maxDepth: number | null
  readonly include: readonly PathFilter[]
  readonly exclude: readonly PathFilter[]
}
const discoverySchema = objectSchema({
  maxDepth: v.nullable(v.pipe(nonnegativeIntegerSchema, v.minValue(1))),
  include: v.pipe(v.array(pathFilterSchema), v.readonly()),
  exclude: v.pipe(v.array(pathFilterSchema), v.readonly()),
})
/** Parse complete discovery settings. Damaged settings never become unlimited defaults. */
export function parseDirectoryDiscoveryDefinition(input: unknown): DirectoryDiscoveryDefinition {
  return parseContract(discoverySchema, input, 'directory discovery definition')
}
/** New directories discover recursively with no include/exclude restriction. */
export function createDefaultDirectoryDiscovery(): DirectoryDiscoveryDefinition {
  return { maxDepth: null, include: [], exclude: [] }
}

export type FileAssociationMode = 'automatic' | 'manual'
/** Register a precise source without creating a work, fetching metadata, or opening content. */
export interface LocalContentInput {
  readonly type: 'directory' | 'file'
  readonly path: string
}
export interface LocalContentRegistrationResult {
  readonly work: WorkRef
  readonly registrations: readonly [
    {
      readonly type: 'directory' | 'file' | 'launchConfig'
      readonly id: string
      readonly outcome: 'registered' | 'alreadyRegistered'
    },
    ...{
      readonly type: 'directory' | 'file' | 'launchConfig'
      readonly id: string
      readonly outcome: 'registered' | 'alreadyRegistered'
    }[],
  ]
  readonly issues: readonly (
    | { readonly code: 'initialRefreshFailed'; readonly error: ErrorSummary }
    | { readonly code: 'launchConfigIncomplete'; readonly launchConfigId: string }
  )[]
}
/** A directory is a saved position, not a preferred content version or a file's persistent parent. */
export type WorkDirectory<Type extends WorkType = WorkType> = Type extends WorkType
  ? {
      readonly id: string
      readonly work: EntryRef<Type>
      readonly path: string
      readonly createdAt: number
      readonly updatedAt: number
    } & (Type extends 'game'
      ? object
      : {
          readonly definition: DefinitionRead<DirectoryDiscoveryDefinition>
          readonly recognitionProfileId: string | null
        })
  : never
export type DirectoryCreate<Type extends WorkType> = {
  readonly path: string
} & (Type extends 'game'
  ? object
  : {
      readonly definition?: DirectoryDiscoveryDefinition
      readonly recognitionProfileId?: string | null
    })
export type DirectoryChanges<Type extends WorkType> = {
  readonly path?: string
} & (Type extends 'game'
  ? object
  : {
      readonly definition?: DirectoryDiscoveryDefinition
      readonly recognitionProfileId?: string | null
    })
/** Observations describe only a completed check; unknown format is independent of actual path availability. */
export type FileAvailability =
  | { readonly status: 'unverified' }
  | { readonly status: 'available' }
  | { readonly status: 'missing' }
  | { readonly status: 'unavailable'; readonly error: ErrorSummary }
/** A saved zero-based ordinal within one source's same-kind tracks; runtime engine IDs are never stored. */
export type FileTrackSelection =
  | { readonly type: 'embedded'; readonly index: number }
  | { readonly type: 'external'; readonly path: string; readonly index: number }
/** These file-specific memories do not participate in the whole-custom-unit preference hierarchy. */
export interface FilePlaybackSettingChanges {
  readonly audioTrack?: FileTrackSelection | null
  readonly subtitleTrack?: FileTrackSelection | null
  readonly audioDelaySeconds?: number
  readonly subtitleDelaySeconds?: number
}

const fileTrackSchema = v.union([
  objectSchema({ type: v.literal('embedded'), index: nonnegativeIntegerSchema }),
  objectSchema({
    type: v.literal('external'),
    path: absolutePathSchema,
    index: nonnegativeIntegerSchema,
  }),
])
/** Validate a source-local track ordinal; the operation still checks its actual kind and current file contents. */
export function parseFileTrackSelection(input: unknown): FileTrackSelection {
  return parseContract(fileTrackSchema, input, 'file track selection')
}
/** Validate only the explicit file memories and their related old values; offsets are finite signed seconds. */
export function parseFilePlaybackSettingsUpdate(input: unknown): {
  readonly changes: FilePlaybackSettingChanges
  readonly expected?: FilePlaybackSettingChanges
} {
  const fields = objectSchema(
    exactPartialEntries({
      audioTrack: v.nullable(fileTrackSchema),
      subtitleTrack: v.nullable(fileTrackSchema),
      audioDelaySeconds: v.pipe(v.number(), v.finite()),
      subtitleDelaySeconds: v.pipe(v.number(), v.finite()),
    }),
  )
  return parseContract(
    v.pipe(
      objectSchema({ changes: fields, expected: v.exactOptional(fields) }),
      v.check((value) => hasRelatedExpected(value.changes, value.expected)),
    ),
    input,
    'file playback settings update',
  )
}
/** A whole custom unit is selected by enabled; disabled units retain every stored setting. */
export interface CustomPreferences<Settings> {
  readonly enabled: boolean
  readonly settings: Settings
}

/** The selected whole custom unit is owned by the actual work or file, never by a logical Part. */
export interface UsagePreferencesByType {
  readonly anime: AnimePlaybackPreferences
  readonly comic: ReadingPreferences
  readonly novel: ReadingPreferences
}
export interface UsagePreferenceChangesByType {
  readonly anime: Partial<AnimePlaybackPreferences>
  readonly comic: ReadingPreferenceChanges
  readonly novel: ReadingPreferenceChanges
}
export interface CustomPreferenceUpdate<Type extends FileWorkType> {
  readonly changes: {
    readonly enabled?: boolean
    readonly settings?: UsagePreferenceChangesByType[Type]
  }
  readonly expected?: {
    readonly enabled?: boolean
    readonly settings?: UsagePreferenceChangesByType[Type]
  }
}
export interface HoldingsPreferencesApi {
  /** Read a complete saved custom unit or null; it is not a merged effective configuration. */
  get<Type extends FileWorkType>(
    scope: { readonly work: EntryRef<Type>; readonly fileId?: string },
    call?: CallOptions,
  ): Promise<DefinitionRead<CustomPreferences<UsagePreferencesByType[Type]>> | null>
  /** Save related fields; first enable initializes the whole unit from the then-effective configuration, while disable retains its settings. */
  update<Type extends FileWorkType>(
    scope: { readonly work: EntryRef<Type>; readonly fileId?: string },
    input: CustomPreferenceUpdate<NoInfer<Type>>,
    call?: CallOptions,
  ): Promise<void>
}
export interface FileAssociation {
  readonly part: PartRef
  readonly isPreferred: boolean
  readonly sortOrder: number
}
export type WorkFile<Type extends FileWorkType = FileWorkType> = Type extends FileWorkType
  ? {
      readonly id: string
      readonly work: EntryRef<Type>
      readonly path: string
      readonly format: string | null
      readonly availability: FileAvailability
      readonly associationMode: FileAssociationMode
      readonly associations: readonly FileAssociation[]
      readonly isPreferred: boolean
      readonly note: string | null
      readonly sortOrder: number
      readonly checkedAt: number | null
      readonly createdAt: number
      readonly updatedAt: number
    } & (Type extends 'anime'
      ? {
          readonly positionSeconds: number | null
          readonly customPreferences: DefinitionRead<
            CustomPreferences<AnimePlaybackPreferences>
          > | null
          readonly audioTrack: FileTrackSelection | null
          readonly subtitleTrack: FileTrackSelection | null
          readonly audioDelaySeconds: number
          readonly subtitleDelaySeconds: number
        }
      : {
          readonly position: ReadingPosition | null
          readonly encoding: TextEncoding | null
          readonly customPreferences: DefinitionRead<CustomPreferences<ReadingPreferences>> | null
        })
  : never
export type FileAssociationChange =
  | { readonly type: 'replace'; readonly parts: readonly PartRef[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly PartRef[]
      readonly remove?: readonly PartRef[]
    }
/** A maintenance report separates actual adopted changes from per-target unresolved observations. */
export interface HoldingsReport {
  readonly work: WorkRef
  readonly registeredFileIds: readonly string[]
  readonly updatedFileIds: readonly string[]
  readonly issues: readonly {
    readonly target: { readonly type: 'directory' | 'file'; readonly id: string }
    readonly error: ErrorSummary
  }[]
}
export interface FileReidentificationResult {
  readonly work: EntryRef<FileWorkType>
  readonly files: readonly (
    | {
        readonly fileId: string
        readonly outcome: 'changed' | 'unchanged'
        readonly parts: readonly PartRef[]
      }
    | { readonly fileId: string; readonly outcome: 'unmatched' | 'ambiguous' | 'missingPart' }
    | { readonly fileId: string; readonly outcome: 'failed'; readonly error: ErrorSummary }
  )[]
}
export interface RelocationResult {
  readonly updated: readonly {
    readonly type: 'directory' | 'file' | 'launchConfig' | 'subtitle'
    readonly id: string
    readonly path: string
  }[]
  readonly issues: readonly {
    readonly type: 'file' | 'launchConfig' | 'subtitle'
    readonly id: string
    readonly error: ErrorSummary
  }[]
}
export interface DirectoriesApi {
  /** Read positions and actual discovery definition state; no implicit filesystem traversal. */
  list<Type extends WorkType>(
    work: EntryRef<Type>,
    call?: CallOptions,
  ): Promise<readonly WorkDirectory<Type>[]>
  /** Read one directory by real owner, or null. */
  get<Type extends WorkType>(
    work: EntryRef<Type>,
    id: string,
    call?: CallOptions,
  ): Promise<WorkDirectory<Type> | null>
  /** Register one nonconflicting position without creating a launch choice or logical part. */
  create<Type extends WorkType>(
    work: EntryRef<Type>,
    input: DirectoryCreate<Type>,
    call?: CallOptions,
  ): Promise<string>
  /** Save exact changed fields; changing discovery filters never rewrites established associations. */
  update<Type extends WorkType>(
    work: EntryRef<Type>,
    id: string,
    input: { readonly changes: DirectoryChanges<Type>; readonly expected?: DirectoryChanges<Type> },
    call?: CallOptions,
  ): Promise<void>
  /** Remove only the directory registration; existing files and game choices remain. */
  delete(work: WorkRef, id: string, call?: CallOptions): Promise<void>
  /** Validate the selected new root and commit valid mappings together; user bytes never move. */
  relocate(
    work: WorkRef,
    id: string,
    input: {
      readonly path: string
      readonly launchConfigFields?: readonly {
        readonly launchConfigId: string
        readonly fields: readonly (
          'launchPath' | 'monitoringPath' | 'workingDirectory' | 'savePath'
        )[]
      }[]
      readonly subtitleFileIds?: readonly string[]
    },
    call?: CallOptions,
  ): Promise<RelocationResult>
}
export interface FilesApi {
  /** Save explicit file-only track memories/offsets; this does not enable a complete custom configuration or control a current player. */
  updatePlaybackSettings(
    work: EntryRef<'anime'>,
    fileId: string,
    input: {
      readonly changes: FilePlaybackSettingChanges
      readonly expected?: FilePlaybackSettingChanges
    },
    call?: CallOptions,
  ): Promise<void>
  /** Save a decoding choice for this reading source; existing stable text locators retain their own decoding identity. */
  setEncoding(
    work: EntryRef<'comic' | 'novel'>,
    fileId: string,
    input: {
      readonly encoding: TextEncoding | null
      readonly expected?: { readonly encoding: TextEncoding | null }
    },
    call?: CallOptions,
  ): Promise<void>
  /** Read bounded files in the real work; directory and association filters do not become an execution range. */
  list<Type extends FileWorkType>(
    work: EntryRef<Type>,
    input: ListOptions & {
      readonly directoryId?: string
      readonly association?: 'linked' | 'unlinked'
      readonly availability?: FileAvailability['status']
    },
    call?: CallOptions,
  ): Promise<ListResult<WorkFile<Type>>>
  /** Read a registered file or null, preserving unavailable paths and saved user choices. */
  get<Type extends FileWorkType>(
    work: EntryRef<Type>,
    fileId: string,
    call?: CallOptions,
  ): Promise<WorkFile<Type> | null>
  /** Add a supported source; explicit parts including an empty set establish manual association mode. */
  create(
    work: EntryRef<FileWorkType>,
    input: {
      readonly path: string
      readonly parts?: readonly PartRef[]
      readonly note?: string | null
    },
    call?: CallOptions,
  ): Promise<string>
  /** Save only a file note against its related baseline. */
  update(
    work: EntryRef<FileWorkType>,
    fileId: string,
    input: {
      readonly changes: { readonly note?: string | null }
      readonly expected?: { readonly note?: string | null }
    },
    call?: CallOptions,
  ): Promise<void>
  /** Remove a file registration and its owned settings without deleting user content. */
  delete(work: EntryRef<FileWorkType>, fileId: string, call?: CallOptions): Promise<void>
  /** Save explicit complete/partial associations and manual mode together; compare the complete old association set and mode when supplied. */
  setAssociations(
    work: EntryRef<FileWorkType>,
    fileId: string,
    input: {
      readonly change: FileAssociationChange
      readonly expected?: {
        readonly associations: readonly FileAssociation[]
        readonly associationMode: FileAssociationMode
      }
    },
    call?: CallOptions,
  ): Promise<void>
  /** Change permission for future automatic matching without altering existing associations. */
  setAssociationMode(
    work: EntryRef<FileWorkType>,
    fileId: string,
    input: {
      readonly mode: FileAssociationMode
      readonly expected?: { readonly associationMode: FileAssociationMode }
    },
    call?: CallOptions,
  ): Promise<void>
  /** Save one work/part default in its precise scope without opening the content. */
  setPreferred(
    scope: EntryRef<FileWorkType> | PartRef,
    input: {
      readonly fileId: string | null
      readonly expected?: { readonly preferredFileId: string | null }
    },
    call?: CallOptions,
  ): Promise<void>
  /** Save nonconflicting explicit part/file pairs atomically; no pairing is inferred from list order. */
  setPreferredMany(
    input: readonly {
      readonly part: PartRef
      readonly fileId: string | null
      readonly expected?: { readonly preferredFileId: string | null }
    }[],
    call?: CallOptions,
  ): Promise<void>
  /** Save one work's file order against its full original order. */
  reorder(work: EntryRef<FileWorkType>, input: OrderChange, call?: CallOptions): Promise<void>
  /** Validate the explicitly selected new path and retain identity, settings, position, and history. */
  relocate(
    work: EntryRef<FileWorkType>,
    fileId: string,
    input: { readonly path: string },
    call?: CallOptions,
  ): Promise<void>
  /** Merge two explicit registrations, retaining target settings and position; no user file is moved or removed. */
  merge(
    work: EntryRef<FileWorkType>,
    input: { readonly sourceFileId: string; readonly targetFileId: string; readonly path: string },
    call?: CallOptions,
  ): Promise<{ readonly fileId: string; readonly removedFileId: string; readonly path: string }>
  /** Clear or set one file's stored playback position; active position writers must be respected. */
  setPlaybackPosition(
    work: EntryRef<'anime'>,
    fileId: string,
    positionSeconds: number | null,
    call?: CallOptions,
  ): Promise<void>
  /** Clear or set the stable locator belonging to this actual reading file. */
  setReadingPosition(
    work: EntryRef<'comic' | 'novel'>,
    fileId: string,
    position: ReadingPosition | null,
    call?: CallOptions,
  ): Promise<void>
}
export interface HoldingsApi {
  readonly preferences: HoldingsPreferencesApi
  readonly directories: DirectoriesApi
  readonly files: FilesApi
  readonly launchConfigs: GameLaunchConfigsApi
  readonly backups: GameBackupsApi
  readonly recognitionProfiles: FileRecognitionProfilesApi
  /** Commit actual registration and perform applicable initial maintenance; post-commit failure retains its legal partial result. */
  registerLocalContent(
    work: WorkRef,
    input: LocalContentInput,
    options?: { readonly expectedIdentities?: readonly [ExternalIdentity, ...ExternalIdentity[]] },
    call?: CallOptions,
  ): Promise<LocalContentRegistrationResult>
  /** Wait until the requested discovery/maintenance range is actually processed; unreadable paths are never an empty successful scan. */
  refresh(work: WorkRef, call?: CallOptions): Promise<HoldingsReport>
  /** Recompute selected files once; valid association changes commit together and failed targets retain their old choices. */
  reidentify(
    work: EntryRef<FileWorkType>,
    input: { readonly fileIds: readonly [string, ...string[]] },
    call?: CallOptions,
  ): Promise<FileReidentificationResult>
  /** Invalidate affected reads after actual committed holdings changes. */
  onInvalidated(listener: (work: WorkRef) => void): Disposable
}

/** Validate an explicit local input without guessing a base directory or inspecting the filesystem. */
export function parseLocalContentInput(input: unknown): LocalContentInput {
  return parseContract(
    objectSchema({ type: v.picklist(['directory', 'file']), path: absolutePathSchema }),
    input,
    'local content input',
  )
}
