/** @fileoverview Defines held-file usage overrides, preferred-file selection and playback choices. */

import type {
  AnimePlaybackPreferences,
  ReadingPreferences,
  PlaybackOverrideChange,
  ReadingOverrideChange,
  UsageOverride,
} from '../../preferences/usage'
import type { FileWorkType, PartRef, EntryRef } from '../catalog'

import type { FilePartType } from './associations'
import type { CallOptions, StoredDefinition, NonEmptyArray } from '../../operations'
import * as v from 'valibot'
import {
  nonnegativeInteger,
  parseValue,
  optionalFields,
  validateExpectedKeys,
  id,
  unique,
} from '../../validation'
import { path } from './directories'
import { partSchema, partKey } from './associations'

/**
 * A source-local saved track selection.
 *
 * Index is the zero-based ordinal among tracks of the field's kind in the source file, independent
 * of runtime track IDs.
 */
export type FileTrackSelection =
  | { readonly type: 'embedded'; readonly index: number }
  | { readonly type: 'external'; readonly path: string; readonly index: number }

/**
 * Saved source-track choices and signed synchronization offsets for one video file.
 *
 * Null selections use language, file and engine fallback rules; they do not disable subtitles.
 */
export interface FilePlaybackChoices {
  readonly audioTrack: FileTrackSelection | null
  readonly subtitleTrack: FileTrackSelection | null
  readonly audioDelaySeconds: number
  readonly subtitleDelaySeconds: number
}

/** The complete usage settings applicable to each file-bearing medium. */
export interface FilePreferencesByType {
  readonly anime: AnimePlaybackPreferences
  readonly comic: ReadingPreferences
  readonly novel: ReadingPreferences
}

/** The override-edit contract applicable to each file-bearing medium. */
export interface FilePreferenceChangeByType {
  readonly anime: PlaybackOverrideChange
  readonly comic: ReadingOverrideChange
  readonly novel: ReadingOverrideChange
}

/** The work-wide or directly associated part scope of a preferred-file choice. */
export type PreferredFileScope<T extends FileWorkType = FileWorkType> =
  | { readonly type: 'work' }
  | { readonly type: 'part'; readonly part: PartRef<FilePartType<T>> }

/** An explicit preferred-file choice or clearing within one scope, with an optional baseline. */
export interface PreferredFileInput<T extends FileWorkType = FileWorkType> {
  readonly scope: PreferredFileScope<T>
  readonly fileId: string | null
  readonly expected?: { readonly preferredFileId: string | null }
}

/** One part's explicit preferred-file choice or clearing in an atomic batch. */
export interface PreferredPartFile<T extends FileWorkType = FileWorkType> {
  readonly part: PartRef<FilePartType<T>>
  readonly fileId: string | null
  readonly expected?: { readonly preferredFileId: string | null }
}

/** The work or file owning a complete saved usage override. */
export type UsagePreferenceTarget =
  | { readonly type: 'work' }
  | { readonly type: 'file'; readonly fileId: string }

/**
 * Saved work and file usage overrides and effective configuration selection.
 *
 * Complete custom settings remain independent of parent changes. Saving does not itself reconfigure
 * open content.
 */
export interface HoldingsPreferencesApi {
  /**
   * Reads a complete saved override.
   *
   * Null means customization is absent; invalid stored definitions remain explicit.
   */
  get<T extends FileWorkType>(
    work: EntryRef<T>,
    target: UsagePreferenceTarget,
    call?: CallOptions,
  ): Promise<StoredDefinition<UsageOverride<FilePreferencesByType[T]>> | null>

  /**
   * Initializes an override from a complete snapshot or compares and changes the existing override.
   *
   * Parent changes do not silently rebase saved custom settings.
   */
  update<
    Args extends {
      [K in FileWorkType]: [
        work: EntryRef<K>,
        target: UsagePreferenceTarget,
        input: FilePreferenceChangeByType[K],
        call?: CallOptions,
      ]
    }[FileWorkType],
  >(
    ...args: Args
  ): Promise<UsageOverride<FilePreferencesByType[Args[0]['type']]>>

  /**
   * Selects one complete enabled file, work or global configuration for the file.
   *
   * Selection does not merge individual fields or reconfigure open content.
   */
  getEffective<T extends FileWorkType>(
    work: EntryRef<T>,
    fileId: string,
    call?: CallOptions,
  ): Promise<{
    readonly source: 'global' | 'work' | 'file'
    readonly settings: FilePreferencesByType[T]
  }>
}

/**
 * Saved per-file source-track choices and offsets.
 *
 * Whole playback overrides and runtime track IDs remain separately owned.
 */
export interface FilePlaybackChoicesApi {
  /** Reads saved source-local choices and offsets, retaining invalid stored values explicitly. */
  get(
    animeId: string,
    fileId: string,
    call?: CallOptions,
  ): Promise<StoredDefinition<FilePlaybackChoices>>

  /** Compares and commits only the submitted saved track choices and offsets. */
  update(
    animeId: string,
    fileId: string,
    input: {
      readonly changes: Partial<FilePlaybackChoices>
      readonly expected?: Partial<FilePlaybackChoices>
    },
    call?: CallOptions,
  ): Promise<void>
}

/** Embedded or external track identity with a nonnegative source track index. */
const track = v.variant('type', [
  v.strictObject({ type: v.literal('embedded'), index: nonnegativeInteger }),
  v.strictObject({ type: v.literal('external'), path, index: nonnegativeInteger }),
])

/** Parses a source-local track ordinal and an absolute external path when applicable. */
export function parseFileTrackSelection(input: unknown): FileTrackSelection {
  return parseValue(track, input, 'Invalid saved track selection')
}

/** Saved source tracks and finite signed offsets shared by whole values and partial edits. */
const playbackChoiceFields = {
  audioTrack: v.nullable(track),
  subtitleTrack: v.nullable(track),
  audioDelaySeconds: v.pipe(v.number(), v.finite()),
  subtitleDelaySeconds: v.pipe(v.number(), v.finite()),
}

/** Parses a complete saved playback choice without applying update or baseline semantics. */
export function parseFilePlaybackChoices(input: unknown): FilePlaybackChoices {
  return parseValue(v.strictObject(playbackChoiceFields), input, 'Invalid saved playback choices')
}

/**
 * Parses complete saved-track references and finite signed-second offsets with matching baselines.
 */
export function parseFilePlaybackChoicesUpdate(input: unknown): {
  readonly changes: Partial<FilePlaybackChoices>
  readonly expected?: Partial<FilePlaybackChoices>
} {
  const fields = v.strictObject(optionalFields(playbackChoiceFields))
  const value = parseValue(
    v.strictObject({ changes: fields, expected: v.exactOptional(fields) }),
    input,
    'Invalid saved playback choices',
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}

/**
 * Parses an explicit preferred-file scope, selection and optional baseline.
 *
 * Commit separately checks availability and direct same-work association.
 */
export function parsePreferredFileInput<T extends FileWorkType>(
  workType: T,
  input: unknown,
): PreferredFileInput<T> {
  return parseValue(
    v.strictObject({
      scope: v.union([
        v.strictObject({ type: v.literal('work') }),
        v.strictObject({ type: v.literal('part'), part: partSchema(workType) }),
      ]),
      fileId: v.nullable(id),
      expected: v.exactOptional(v.strictObject({ preferredFileId: v.nullable(id) })),
    }),
    input,
    'Invalid preferred file',
  ) as PreferredFileInput<T>
}

/**
 * Parses a nonempty preferred-file batch with each part represented once.
 *
 * One file may be preferred for multiple directly associated parts.
 */
export function parsePreferredPartFiles<T extends FileWorkType>(
  workType: T,
  input: unknown,
): NonEmptyArray<PreferredPartFile<T>> {
  const item = v.strictObject({
    part: partSchema(workType),
    fileId: v.nullable(id),
    expected: v.exactOptional(v.strictObject({ preferredFileId: v.nullable(id) })),
  })
  return parseValue(
    v.pipe(
      v.tupleWithRest([item], item),
      v.check((items) => unique(items, (item) => partKey(item.part))),
    ),
    input,
    'Invalid preferred part files',
  ) as NonEmptyArray<PreferredPartFile<T>>
}
