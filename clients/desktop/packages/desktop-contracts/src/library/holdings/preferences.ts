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

export type UsagePreferenceTarget =
  { readonly type: 'work' } | { readonly type: 'file'; readonly fileId: string }

/** Complete custom settings stay independent of parent changes and do not reconfigure already-open content by themselves. */
export interface HoldingsPreferencesApi {
  /**
   * Read the work or file's saved complete override, distinguishing absent customization from an
   * invalid stored definition.
   */
  get<T extends FileWorkType>(
    work: EntryRef<T>,
    target: UsagePreferenceTarget,
    call?: CallOptions,
  ): Promise<StoredDefinition<UsageOverride<FilePreferencesByType[T]>> | null>

  /**
   * Initialize from the supplied complete snapshot or compare and change the existing override;
   * parent changes do not silently rebase it.
   */
  update(
    ...args: {
      [K in FileWorkType]: [
        work: EntryRef<K>,
        target: UsagePreferenceTarget,
        input: FilePreferenceChangeByType[K],
        call?: CallOptions,
      ]
    }[FileWorkType]
  ): Promise<UsageOverride<FilePreferencesByType[FileWorkType]>>

  /**
   * Select one complete enabled file, work or global configuration for this file; do not merge
   * individual fields or reconfigure open content.
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

/** File-specific saved choices are independent of whole playback overrides and runtime track IDs. */
export interface FilePlaybackChoicesApi {
  /**
   * Read saved source-local audio/subtitle choices and offsets, retaining invalid stored
   * definitions explicitly.
   */
  get(
    animeId: string,
    fileId: string,
    call?: CallOptions,
  ): Promise<StoredDefinition<FilePlaybackChoices>>

  /**
   * Compare and commit only the submitted saved choices; opaque runtime track IDs and whole
   * playback overrides remain separate.
   */
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

/** A source-local same-kind track ordinal is not a session's opaque runtime track ID. */
export function parseFileTrackSelection(input: unknown): FileTrackSelection {
  return parseValue(track, input, 'Invalid saved track selection')
}

/** Saved audio/subtitle choices replace complete references and signed finite-second offsets. */
export function parseFilePlaybackChoicesUpdate(input: unknown): {
  readonly changes: Partial<FilePlaybackChoices>
  readonly expected?: Partial<FilePlaybackChoices>
} {
  const fields = v.strictObject(
    optionalFields({
      audioTrack: v.nullable(track),
      subtitleTrack: v.nullable(track),
      audioDelaySeconds: v.pipe(v.number(), v.finite()),
      subtitleDelaySeconds: v.pipe(v.number(), v.finite()),
    }),
  )
  const value = parseValue(
    v.strictObject({ changes: fields, expected: v.exactOptional(fields) }),
    input,
    'Invalid saved playback choices',
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}

/** Validate an explicit preferred-file scope. Availability and a direct same-work association are checked at commit. */
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

/** Each part appears once; a chosen file may legitimately be preferred for more than one directly associated part. */
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
