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

export type FileTrackSelection =
  | { readonly type: 'embedded'; readonly index: number }
  | { readonly type: 'external'; readonly path: string; readonly index: number }

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

export interface PreferredPartFile<T extends FileWorkType = FileWorkType> {
  readonly part: PartRef<FilePartType<T>>
  readonly fileId: string | null
  readonly expected?: { readonly preferredFileId: string | null }
}

export type UsagePreferenceTarget =
  | { readonly type: 'work' }
  | { readonly type: 'file'; readonly fileId: string }

export interface HoldingsPreferencesApi {
  get<T extends FileWorkType>(
    work: EntryRef<T>,
    target: UsagePreferenceTarget,
    call?: CallOptions,
  ): Promise<StoredDefinition<UsageOverride<FilePreferencesByType[T]>> | null>

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
