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

/** The latest saved file-access observation: unchecked, accessible or known unavailable. */
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

/**
 * Decoded video container, duration and frame dimensions, retaining unknown measurements as null.
 */
export interface AnimeFileMetadata {
  readonly container: string
  readonly durationSeconds: number | null
  /** Decoded frame width in pixels, or null when unavailable. */
  readonly width: number | null
  /** Decoded frame height in pixels, or null when unavailable. */
  readonly height: number | null
}

/** Detected reading format and page count when the content provides one. */
export interface ReadingFileMetadata {
  readonly format: 'epub' | 'mobi' | 'fb2' | 'txt' | 'pdf' | 'images'
  readonly pageCount: number | null
}

/**
 * The saved matching mode or an explicit corruption error.
 *
 * An unreadable mode disables automatic adoption while the file and its other facts remain visible.
 */
type FileAssociationState =
  | { readonly associationMode: FileAssociationMode; readonly associationError: null }
  | { readonly associationMode: null; readonly associationError: ErrorSummary }

/**
 * A work-owned file registration with saved associations, availability and usage state.
 *
 * Unavailable stored definitions remain explicit and do not remove the registration.
 */
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
          /**
           * Saved playback position in seconds, with unavailable stored data distinguished from
           * absence.
           */
          readonly position: StoredDefinition<number> | null
          readonly playbackChoices: StoredDefinition<FilePlaybackChoices>
        }
      : {
          readonly kind: 'file' | 'directory'
          readonly metadata: StoredDefinition<ReadingFileMetadata> | null
          readonly position: StoredDefinition<ReadingPosition> | null
          /**
           * Display progress through the file's main reading path in [0, 1], or null when unknown.
           */
          readonly progress: number | null
          readonly textEncoding: TextEncoding | null
        })
}[T]

/**
 * A file path and optional initial note, preferences and direct associations.
 *
 * Explicit associations, including an empty array, select manual mode. Omission permits automatic
 * matching.
 */
export interface FileCreateFields<T extends FileWorkType = FileWorkType> {
  readonly path: string
  readonly note?: string | null
  readonly associations?: readonly FileAssociationInput<T>[]
  readonly isPreferred?: boolean
}

/**
 * Filters over saved file facts and access observations.
 *
 * Listing does not probe disk or start content; part filtering uses direct associations.
 */
export interface FileQuery<T extends FileWorkType = FileWorkType> {
  readonly search: string
  readonly directoryId?: string
  readonly part?: PartRef<FilePartType<T>>
  readonly association?: 'associated' | 'unassociated'
  readonly associationMode?: FileAssociationMode
  readonly availability?: FileAvailability['status']
}

/** Two duplicate registrations, an explicit survivor and one participant's retained access path. */
export interface FileMergeInput {
  readonly sourceFileId: string
  readonly targetFileId: string
  readonly path: string
}

/** The surviving file identity, removed registration and retained access path after merge. */
export interface FileMergeResult {
  readonly fileId: string
  readonly removedFileId: string
  readonly path: string
}

/**
 * Work-owned file registrations, associations, preferred choices and identity maintenance.
 *
 * Association and path changes respect active-file occupancy.
 */
export interface HeldFilesApi {
  /** Lists saved registrations under the requested filters, retaining unavailable files. */
  list<T extends FileWorkType>(
    work: EntryRef<T>,
    query: FileQuery<T>,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<HeldFile<T>>>

  /**
   * Reads saved file facts and availability, or null when the registration is absent.
   *
   * The read leaves content sessions and position unchanged.
   */
  get<T extends FileWorkType>(
    work: EntryRef<T>,
    fileId: string,
    call?: CallOptions,
  ): Promise<HeldFile<T> | null>

  /**
   * Registers a file or reuses its existing same-position identity.
   *
   * Existing state remains unless explicit association intent was supplied.
   */
  add(
    ...args: {
      [K in FileWorkType]: [work: EntryRef<K>, input: FileCreateFields<K>, call?: CallOptions]
    }[FileWorkType]
  ): Promise<string>

  /** Compares and saves the file note independently of association, path and playback state. */
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
   * Removes selected registrations and maintains their references after checking active use.
   *
   * User-file bytes remain untouched.
   */
  delete(
    work: EntryRef<FileWorkType>,
    fileIds: NonEmptyArray<string>,
    call?: CallOptions,
  ): Promise<void>

  /**
   * Compares and commits explicit association changes together with manual matching mode.
   *
   * Active-file occupancy is rechecked before adoption.
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

  /**
   * Changes the matching mode while preserving the association set.
   *
   * Mode-only changes are allowed during current use.
   */
  setAssociationMode(
    work: EntryRef<FileWorkType>,
    fileId: string,
    input: {
      readonly mode: FileAssociationMode
      readonly expected?: { readonly associationMode: FileAssociationMode }
    },
    call?: CallOptions,
  ): Promise<void>

  /** Sets or clears a work or part preference after ownership, association and baseline checks. */
  setPreferred(
    ...args: {
      [K in FileWorkType]: [work: EntryRef<K>, input: PreferredFileInput<K>, call?: CallOptions]
    }[FileWorkType]
  ): Promise<void>

  /**
   * Compares and commits all supplied part preferences atomically.
   *
   * An invalid target or failed baseline rejects the complete batch.
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
   * Verifies a selected access path and retains the file's identity and saved state.
   *
   * Another registration at that path produces a conflict.
   */
  relocate<T extends FileWorkType>(
    work: EntryRef<T>,
    fileId: string,
    input: { readonly path: string; readonly expected?: { readonly path: string } },
    call?: CallOptions,
  ): Promise<HoldingsRelocationResult<T>>

  /**
   * Retains the chosen survivor and participant path, migrating saved references atomically.
   *
   * Both registrations are checked for occupancy before commit.
   */
  merge(
    work: EntryRef<FileWorkType>,
    input: FileMergeInput,
    call?: CallOptions,
  ): Promise<FileMergeResult>

  /**
   * Computes recognition for all selected files before committing valid association changes
   * together.
   *
   * Each file retains its matching mode.
   */
  reidentify<T extends FileWorkType>(
    work: EntryRef<T>,
    fileIds: NonEmptyArray<string>,
    call?: CallOptions,
  ): Promise<FileReidentificationResult<T>>

  /**
   * Tests a draft against an actual file without changing associations, mode, preference or
   * position.
   */
  testRecognition<T extends FileWorkType>(
    work: EntryRef<T>,
    fileId: string,
    input?: { readonly definition?: FileRecognitionDefinition<T> },
    call?: CallOptions,
  ): Promise<FileRecognitionResult<T>>

  readonly playbackChoices: FilePlaybackChoicesApi
}

/** Parses file registration intent with unique associations of the applicable part kinds. */
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

/** Parses saved-fact filters and a medium-specific direct-association scope. */
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

/**
 * Parses distinct merge participants and an absolute retained path.
 *
 * The host checks actual owners and whether the path belongs to a participant.
 */
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
