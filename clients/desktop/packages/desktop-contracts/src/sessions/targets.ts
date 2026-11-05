/** @fileoverview Defines work and file selectors for session operations and public opening links. */

import * as v from 'valibot'
import type { FileWorkType } from '../library/catalog'
import type { PlaybackPositionInput, ReadingPositionInput } from '../library/reading'
import { parseReadingPosition } from '../library/reading'
import { parseValue, nonnegativeNumber, id, optionalFields } from '../validation'

/** Explicit position, including start, always requires an explicit file identity. All supplied selectors constrain the target. */
export type FilePositionChoice<P> =
  | { readonly fileId?: string; readonly position?: never }
  | { readonly fileId: string; readonly position: P }

export interface GameOpenInput {
  readonly gameId: string
  readonly launchConfigId?: string
}

export type AnimeOpenInput = { readonly animeId: string } & (
  | { readonly episodeId?: string; readonly extraId?: never }
  | { readonly episodeId?: never; readonly extraId: string }
) &
  FilePositionChoice<PlaybackPositionInput>

export type ComicOpenInput = {
  readonly comicId: string
  readonly volumeId?: string
  readonly chapterId?: string
} & FilePositionChoice<ReadingPositionInput>

export type NovelOpenInput = {
  readonly novelId: string
  readonly volumeId?: string
} & FilePositionChoice<ReadingPositionInput>

export interface FileSwitchInput<P> {
  readonly fileId: string
  readonly position?: P
}

const playbackInput = v.union([v.literal('start'), nonnegativeNumber])

const readingInput = v.union([
  v.literal('start'),
  v.pipe(v.unknown(), v.transform(parseReadingPosition)),
])

export const openSelectionEntries = {
  game: optionalFields({ launchConfigId: id }),
  anime: optionalFields({ episodeId: id, extraId: id, fileId: id, position: playbackInput }),
  comic: optionalFields({ volumeId: id, chapterId: id, fileId: id, position: readingInput }),
  novel: optionalFields({ volumeId: id, fileId: id, position: readingInput }),
}

/** Bind the medium's selectors to the identity accepted by the calling entry point. */
export function openTargetSchema<
  K extends keyof typeof openSelectionEntries,
  E extends v.ObjectEntries,
>(workType: K, identity: E) {
  return v.pipe(
    v.strictObject({ ...identity, ...openSelectionEntries[workType] }),
    v.check(
      (value) => !('position' in value) || 'fileId' in value,
      'An explicit position requires a file',
    ),
    v.check(
      (value) => !('episodeId' in value && 'extraId' in value),
      'Episode and extra selectors are mutually exclusive',
    ),
  )
}

/** Validate current-file location input; start remains an instruction until the executor returns actual coordinates. */
export function parsePlaybackPositionInput(input: unknown): PlaybackPositionInput {
  return parseValue(playbackInput, input, 'Invalid playback position')
}

/** Accept a persistent reading coordinate or the transient start instruction without resolving document content. */
export function parseReadingPositionInput(input: unknown): ReadingPositionInput {
  return parseValue(readingInput, input, 'Invalid reading position input')
}

/** Parse a local game target and its optional launch configuration. */
export function parseGameOpenInput(input: unknown): GameOpenInput {
  return parseValue(
    openTargetSchema('game', { gameId: id }),
    input,
    'Invalid game open input',
  ) as GameOpenInput
}

/** Parse an anime target with an optional episode or extra and file-bound playback position. */
export function parseAnimeOpenInput(input: unknown): AnimeOpenInput {
  return parseValue(
    openTargetSchema('anime', { animeId: id }),
    input,
    'Invalid anime open input',
  ) as AnimeOpenInput
}

/** Parse a comic target with volume, chapter and file-bound reading selectors. */
export function parseComicOpenInput(input: unknown): ComicOpenInput {
  return parseValue(
    openTargetSchema('comic', { comicId: id }),
    input,
    'Invalid comic open input',
  ) as ComicOpenInput
}

/** Parse a novel target with volume and file-bound reading selectors. */
export function parseNovelOpenInput(input: unknown): NovelOpenInput {
  return parseValue(
    openTargetSchema('novel', { novelId: id }),
    input,
    'Invalid novel open input',
  ) as NovelOpenInput
}

/** A switch fixes the requested file; reading and playback coordinate families cannot cross. */
export function parseFileSwitchInput(
  type: 'anime',
  input: unknown,
): FileSwitchInput<PlaybackPositionInput>

/** Validate the requested reading file and optional reading coordinate without accepting playback seconds. */
export function parseFileSwitchInput(
  type: 'comic' | 'novel',
  input: unknown,
): FileSwitchInput<ReadingPositionInput>

export function parseFileSwitchInput(
  type: FileWorkType,
  input: unknown,
): FileSwitchInput<PlaybackPositionInput | ReadingPositionInput> {
  return parseValue(
    v.strictObject({
      fileId: id,
      position: v.exactOptional(type === 'anime' ? playbackInput : readingInput),
    }),
    input,
    'Invalid file switch',
  )
}
