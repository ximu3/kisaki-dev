import type {
  AnimePlaybackPreferences,
  ReadingPreferences,
  PlaybackOverrideChange,
  ReadingOverrideChange,
  UsageOverride,
} from '../../preferences/usage'
import type { FileWorkType, PartRef, EntryRef } from '../catalog'

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
import { partSchema, partKey, type FilePartType } from './associations'

/**
 * Index is the zero-based ordinal among tracks of the field's kind in this source file. It remains
 * independent of runtime track IDs.
 */
export type FileTrackSelection =
  | { readonly type: 'embedded'; readonly index: number }
  | { readonly type: 'external'; readonly path: string; readonly index: number }

/**
 * Null selections use the language, file and engine fallback rules. Subtitle disablement is
 * separate.
 */
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

export type PreferredFileScope<T extends FileWorkType = FileWorkType> =
  | { readonly type: 'work' }
  | { readonly type: 'part'; readonly part: PartRef<FilePartType<T>> }

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

export type UsagePreferenceTarget =
  | { readonly type: 'work' }
  | { readonly type: 'file'; readonly fileId: string }

/**
 * Saved custom settings retain their values when parent settings change. Saving leaves open content
 * as it is.
 */
export interface HoldingsPreferencesApi {
  /** Null means customization is absent. An invalid stored definition is reported explicitly. */
  get<T extends FileWorkType>(
    work: EntryRef<T>,
    target: UsagePreferenceTarget,
    call?: CallOptions,
  ): Promise<StoredDefinition<UsageOverride<FilePreferencesByType[T]>> | null>

  /**
   * Initialization takes a complete snapshot. Later parent changes leave saved custom settings
   * independent.
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
   * Chooses a complete enabled configuration from file, work or global settings. Selection leaves
   * open content as it is.
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

export interface FilePlaybackChoicesApi {
  /** Reads saved source-local choices and offsets, retaining invalid stored values explicitly. */
  get(
    animeId: string,
    fileId: string,
    call?: CallOptions,
  ): Promise<StoredDefinition<FilePlaybackChoices>>

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

const track = v.variant('type', [
  v.strictObject({ type: v.literal('embedded'), index: nonnegativeInteger }),
  v.strictObject({ type: v.literal('external'), path, index: nonnegativeInteger }),
])

/** Parses a source-local track ordinal and an absolute external path when applicable. */
export function parseFileTrackSelection(input: unknown): FileTrackSelection {
  return parseValue(track, input, 'Invalid saved track selection')
}

const playbackChoiceFields = {
  audioTrack: v.nullable(track),
  subtitleTrack: v.nullable(track),
  audioDelaySeconds: v.pipe(v.number(), v.finite()),
  subtitleDelaySeconds: v.pipe(v.number(), v.finite()),
}

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

/** The write owner verifies file availability and direct same-work association. */
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

/** Each part can appear once. A file can be preferred for several directly associated parts. */
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
