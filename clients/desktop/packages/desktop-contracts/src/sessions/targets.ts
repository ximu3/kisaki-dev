/** @fileoverview Defines work and file selectors for session operations and public opening links. */

import * as v from 'valibot'
import type { FileWorkType } from '../library/catalog'
import type { PlaybackPositionInput, ReadingPositionInput } from '../library/reading'
import { parseReadingPosition } from '../library/reading'
import { parseValue, nonnegativeNumber, id, optionalFields } from '../validation'

/**
 * Optional file selection with a position allowed only when the file is explicit.
 *
 * The start instruction also requires a file ID; all supplied selectors constrain the target
 * together.
 */
export type FilePositionChoice<P> =
  | { readonly fileId?: string; readonly position?: never }
  | { readonly fileId: string; readonly position: P }

/** Local game target with an optional explicit launch configuration. */
export interface GameOpenInput {
  readonly gameId: string
  readonly launchConfigId?: string
}

/** Anime target with an optional episode or extra and file-bound playback position. */
export type AnimeOpenInput = { readonly animeId: string } & (
  | { readonly episodeId?: string; readonly extraId?: never }
  | { readonly episodeId?: never; readonly extraId: string }
) &
  FilePositionChoice<PlaybackPositionInput>

/** Comic target constrained by any supplied volume, chapter, file and reading position. */
export type ComicOpenInput = {
  readonly comicId: string
  readonly volumeId?: string
  readonly chapterId?: string
} & FilePositionChoice<ReadingPositionInput>

/** Novel target constrained by any supplied volume, file and reading position. */
export type NovelOpenInput = {
  readonly novelId: string
  readonly volumeId?: string
} & FilePositionChoice<ReadingPositionInput>

/** Explicit target file with an optional position for a session switch. */
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

/**
 * Builds a medium-specific opening schema around the entry point's accepted identity fields.
 *
 * Positions require a file, and anime episode and extra selectors are mutually exclusive.
 */
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

/**
 * Parses file-local seconds or the transient start instruction.
 *
 * The executor resolves start to an actual position.
 */
export function parsePlaybackPositionInput(input: unknown): PlaybackPositionInput {
  return parseValue(playbackInput, input, 'Invalid playback position')
}

/**
 * Parses a persistent reading coordinate or transient start instruction without resolving document
 * content.
 */
export function parseReadingPositionInput(input: unknown): ReadingPositionInput {
  return parseValue(readingInput, input, 'Invalid reading position input')
}

/** Parses a local game target and its optional launch configuration. */
export function parseGameOpenInput(input: unknown): GameOpenInput {
  return parseValue(
    openTargetSchema('game', { gameId: id }),
    input,
    'Invalid game open input',
  ) as GameOpenInput
}

/** Parses an anime target with an optional episode or extra and file-bound playback position. */
export function parseAnimeOpenInput(input: unknown): AnimeOpenInput {
  return parseValue(
    openTargetSchema('anime', { animeId: id }),
    input,
    'Invalid anime open input',
  ) as AnimeOpenInput
}

/** Parses a comic target with optional volume, chapter and file-bound reading selectors. */
export function parseComicOpenInput(input: unknown): ComicOpenInput {
  return parseValue(
    openTargetSchema('comic', { comicId: id }),
    input,
    'Invalid comic open input',
  ) as ComicOpenInput
}

/** Parses a novel target with optional volume and file-bound reading selectors. */
export function parseNovelOpenInput(input: unknown): NovelOpenInput {
  return parseValue(
    openTargetSchema('novel', { novelId: id }),
    input,
    'Invalid novel open input',
  ) as NovelOpenInput
}

/** Parses an explicit anime file and optional playback position. */
export function parseFileSwitchInput(
  type: 'anime',
  input: unknown,
): FileSwitchInput<PlaybackPositionInput>

/** Parses an explicit comic or novel file and optional reading position. */
export function parseFileSwitchInput(
  type: 'comic' | 'novel',
  input: unknown,
): FileSwitchInput<ReadingPositionInput>

/** Parses a file-switch target using the selected medium's coordinate family. */
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
