import type { ErrorSummary } from '../../errors'
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
import { parseValue, text, unique, id } from '../../validation'
import * as v from 'valibot'
import { path, type HoldingsRelocationResult } from './directories'
import {
  associationSchema,
  partKey,
  partSchema,
  mode,
  type FileAssociationMode,
  type FileAssociation,
  type FileAssociationInput,
  type FilePartType,
  type FileAssociationEdit,
} from './associations'

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
  /** Decoded frame width in pixels, or null when unavailable. */
  readonly width: number | null
  /** Decoded frame height in pixels, or null when unavailable. */
  readonly height: number | null
}

export interface ReadingFileMetadata {
  readonly format: 'epub' | 'mobi' | 'fb2' | 'txt' | 'pdf' | 'images'
  readonly pageCount: number | null
}

/** An unreadable matching mode disables automatic adoption. Other file facts remain visible. */
type FileAssociationState =
  | { readonly associationMode: FileAssociationMode; readonly associationError: null }
  | { readonly associationMode: null; readonly associationError: ErrorSummary }

/** An unavailable stored definition leaves the file registration visible. */
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
 * An explicit association list selects manual mode, even when empty. Omission permits automatic
 * matching.
 */
export interface FileCreateFields<T extends FileWorkType = FileWorkType> {
  readonly path: string
  readonly note?: string | null
  readonly associations?: readonly FileAssociationInput<T>[]
  readonly isPreferred?: boolean
}

/**
 * Filters use saved observations and direct associations. Listing leaves files and sessions closed.
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

export interface FileMergeResult {
  readonly fileId: string
  readonly removedFileId: string
  readonly path: string
}

/** Association and path changes respect active-file occupancy. */
export interface HeldFilesApi {
  list<T extends FileWorkType>(
    work: EntryRef<T>,
    query: FileQuery<T>,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<HeldFile<T>>>

  /**
   * Returns null for an absent registration. Reading preserves the current session and position.
   */
  get<T extends FileWorkType>(
    work: EntryRef<T>,
    fileId: string,
    call?: CallOptions,
  ): Promise<HeldFile<T> | null>

  /**
   * Reuses a same-position registration. Existing state changes only when explicit association
   * intent is supplied.
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
   * Checks active use before removing registrations and their references. User-file bytes remain in
   * place.
   */
  delete(
    work: EntryRef<FileWorkType>,
    fileIds: NonEmptyArray<string>,
    call?: CallOptions,
  ): Promise<void>

  /** Association edits adopt manual mode in the same commit after rechecking occupancy. */
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

  /** A mode-only change preserves associations and is allowed during current use. */
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

  /** A failed baseline or invalid part preference rejects the whole batch. */
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
   * Relocation preserves saved identity and state. Another registration at the selected path causes
   * a conflict.
   */
  relocate<T extends FileWorkType>(
    work: EntryRef<T>,
    fileId: string,
    input: { readonly path: string; readonly expected?: { readonly path: string } },
    call?: CallOptions,
  ): Promise<HoldingsRelocationResult<T>>

  /**
   * Both registrations must be free of active use before their references can move to the chosen
   * survivor in one transaction.
   */
  merge(
    work: EntryRef<FileWorkType>,
    input: FileMergeInput,
    call?: CallOptions,
  ): Promise<FileMergeResult>

  /**
   * Computes recognition for the entire selection before adopting valid associations together. Each
   * file retains its matching mode.
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
 * The operation verifies actual ownership and whether the retained path belongs to a participant.
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
