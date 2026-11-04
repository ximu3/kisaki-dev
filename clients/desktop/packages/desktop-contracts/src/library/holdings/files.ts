/** @fileoverview Defines held-file facts, queries, editing and merge operations. */

import type { ErrorSummary } from '../../errors'
import type {
  FileAssociationMode,
  FileAssociation,
  FileAssociationInput,
  FilePartType,
  FileAssociationEdit,
} from './associations'
import type {
  FileReidentificationResult,
  FileRecognitionDefinition,
  FileRecognitionResult,
} from './file-recognition'
import type { FileWorkType, EntryRef, PartRef } from '../catalog'

import type {
  StoredDefinition,
  ListOptions,
  CallOptions,
  ListResult,
  NonEmptyArray,
} from '../../operations'
import type { UsageOverride } from '../../preferences/usage'
import type {
  FilePreferencesByType,
  FilePlaybackChoices,
  PreferredFileInput,
  PreferredPartFile,
  FilePlaybackChoicesApi,
} from './preferences'
import type { ReadingPosition, TextEncoding } from '../reading'
import type { HoldingsRelocationResult } from './directories'
import { parseValue, text, unique, id } from '../../validation'
import * as v from 'valibot'
import { path } from './directories'
import { associationSchema, partKey, partSchema, mode } from './associations'

/** Unknown, positively accessible and known unavailable observations never collapse into the same state. */
export type FileAvailability =
  | { readonly status: 'unchecked' }
  | {
      readonly status: 'accessible'
      /** UTC milliseconds since the Unix epoch. */
      readonly checkedAt: number
    }
  | {
      readonly status: 'unavailable'
      /** UTC milliseconds since the Unix epoch. */
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
    /** UTC milliseconds since the Unix epoch. */
    readonly createdAt: number
    /** UTC milliseconds since the Unix epoch. */
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

/** Actual files belong directly to a work. Explicit association/path changes must respect active-file occupancy. */
export interface HeldFilesApi {
  /**
   * Read this work's saved file registrations under the requested filters; unavailable files
   * remain registered.
   */
  list<T extends FileWorkType>(
    work: EntryRef<T>,
    query: FileQuery<T>,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<HeldFile<T>>>

  /**
   * Read the saved file facts and availability without opening content or changing its position.
   */
  get<T extends FileWorkType>(
    work: EntryRef<T>,
    fileId: string,
    call?: CallOptions,
  ): Promise<HeldFile<T> | null>

  /** Return the actual new or reused same-position identity, preserving existing state unless explicit association intent was supplied. */
  add(
    ...args: {
      [K in FileWorkType]: [work: EntryRef<K>, input: FileCreateFields<K>, call?: CallOptions]
    }[FileWorkType]
  ): Promise<string>

  /** Compare and save only the file note, independently of association, path and playback state. */
  update(
    work: EntryRef<FileWorkType>,
    fileId: string,
    input: {
      readonly changes: { readonly note?: string | null }
      readonly expected?: { readonly note?: string | null }
    },
    call?: CallOptions,
  ): Promise<void>

  /**
   * Remove the selected registrations and maintain their references after checking active use;
   * leave user file bytes untouched.
   */
  delete(
    work: EntryRef<FileWorkType>,
    fileIds: NonEmptyArray<string>,
    call?: CallOptions,
  ): Promise<void>

  /**
   * Compare and commit the complete explicit association edit and set manual mode together;
   * active-file occupancy is rechecked.
   */
  editAssociations(
    ...args: {
      [K in FileWorkType]: [
        work: EntryRef<K>,
        fileId: string,
        input: FileAssociationEdit<K>,
        call?: CallOptions,
      ]
    }[FileWorkType]
  ): Promise<void>

  /** Saving a manual association edit also sets manual. Mode-only changes preserve associations and allow current use. */
  setAssociationMode(
    work: EntryRef<FileWorkType>,
    fileId: string,
    input: {
      readonly mode: FileAssociationMode
      readonly expected?: { readonly associationMode: FileAssociationMode }
    },
    call?: CallOptions,
  ): Promise<void>

  /**
   * Set or clear the explicit work or part preference after checking ownership, association and
   * any submitted baseline.
   */
  setPreferred(
    ...args: {
      [K in FileWorkType]: [work: EntryRef<K>, input: PreferredFileInput<K>, call?: CallOptions]
    }[FileWorkType]
  ): Promise<void>

  /**
   * Compare and commit all supplied part preferences atomically; any invalid target or failed
   * baseline rejects the batch.
   */
  setPreferredMany(
    ...args: {
      [K in FileWorkType]: [
        work: EntryRef<K>,
        items: NonEmptyArray<PreferredPartFile<K>>,
        call?: CallOptions,
      ]
    }[FileWorkType]
  ): Promise<void>

  /**
   * Verify a newly selected access path while retaining file identity and saved state; another
   * registration at that path is a conflict.
   */
  relocate(
    work: EntryRef<FileWorkType>,
    fileId: string,
    input: { readonly path: string; readonly expected?: { readonly path: string } },
    call?: CallOptions,
  ): Promise<HoldingsRelocationResult>

  /**
   * Retain the explicit target identity and one participant's selected path, migrating saved
   * references atomically after occupancy checks.
   */
  merge(
    work: EntryRef<FileWorkType>,
    input: FileMergeInput,
    call?: CallOptions,
  ): Promise<FileMergeResult>

  /** Compute all selected files first; the valid association changes commit in one short transaction and retain each mode. */
  reidentify<T extends FileWorkType>(
    work: EntryRef<T>,
    fileIds: NonEmptyArray<string>,
    call?: CallOptions,
  ): Promise<FileReidentificationResult<T>>

  /** Test a draft against an actual file without changing its associations, mode, preference or position. */
  testRecognition<T extends FileWorkType>(
    work: EntryRef<T>,
    fileId: string,
    input?: { readonly definition?: FileRecognitionDefinition<T> },
    call?: CallOptions,
  ): Promise<FileRecognitionResult<T>>

  readonly playbackChoices: FilePlaybackChoicesApi
}

/** Validate new-file intent, including compatible real part kinds and unique explicit associations. */
export function parseFileCreateFields<T extends FileWorkType>(
  workType: T,
  input: unknown,
): FileCreateFields<T> {
  return parseValue(
    v.strictObject({
      path,
      note: v.exactOptional(v.nullable(text)),
      associations: v.exactOptional(
        v.pipe(
          v.array(associationSchema(workType)),
          v.check((items) => unique(items, (item) => partKey(item.part))),
        ),
      ),
      isPreferred: v.exactOptional(v.boolean()),
    }),
    input,
    'Invalid file registration',
  ) as FileCreateFields<T>
}

/** Validate query facts without probing files; a part filter is an exact direct association scope. */
export function parseFileQuery<T extends FileWorkType>(workType: T, input: unknown): FileQuery<T> {
  return parseValue(
    v.strictObject({
      search: text,
      directoryId: v.exactOptional(id),
      part: v.exactOptional(partSchema(workType)),
      association: v.exactOptional(v.picklist(['associated', 'unassociated'])),
      associationMode: v.exactOptional(mode),
      availability: v.exactOptional(v.picklist(['unchecked', 'accessible', 'unavailable'])),
    }),
    input,
    'Invalid file query',
  ) as FileQuery<T>
}

/** Reject merging a file identity into itself. The host additionally checks both owners and the chosen current path. */
export function parseFileMergeInput(input: unknown): FileMergeInput {
  return parseValue(
    v.pipe(
      v.strictObject({ sourceFileId: id, targetFileId: id, path }),
      v.check((value) => value.sourceFileId !== value.targetFileId),
    ),
    input,
    'Invalid file merge',
  )
}
