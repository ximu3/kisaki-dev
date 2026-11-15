/** @fileoverview Validates stored file observations and configuration values without opening user content. */

import * as v from 'valibot'
import { DesktopError, parseErrorSummary } from '@kisaki3/desktop-contracts/errors'
import {
  parseAnimePlaybackPreferences,
  parseReadingPreferences,
} from '@kisaki3/desktop-contracts/preferences'
import type {
  AnimeFileMetadata,
  ReadingFileMetadata,
  FileAvailability,
} from '@kisaki3/desktop-contracts/library'
import type {
  AnimePlaybackPreferences,
  ReadingPreferences,
  UsageOverride,
} from '@kisaki3/desktop-contracts/preferences'

/** Nonnegative safe-integer observations used for file counts and dimensions. */
const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0))

/** Positive safe-integer observations for known dimensions and page counts. */
const positiveCount = v.pipe(count, v.minValue(1))

/** Safe integer UTC milliseconds used by saved file-access observations. */
const instant = v.pipe(v.number(), v.safeInteger())

/** Finite nonnegative seconds used for media duration and playback position. */
const seconds = v.pipe(v.number(), v.finite(), v.minValue(0))

/** Applies a local storage schema and uses the shared value-error category. */
function parse<T>(schema: v.GenericSchema<unknown, T>, input: unknown): T {
  const result = v.safeParse(schema, input)
  if (!result.success) {
    throw new DesktopError('InvalidInput', 'Invalid stored file value')
  }
  return result.output
}

/** Validates actual observed video metadata, retaining unknown dimensions and duration. */
export function parseAnimeMetadata(input: unknown): AnimeFileMetadata {
  return parse(
    v.strictObject({
      container: v.pipe(v.string(), v.nonEmpty()),
      durationSeconds: v.nullable(seconds),
      width: v.nullable(positiveCount),
      height: v.nullable(positiveCount),
    }),
    input,
  )
}

/** Validates actual reading metadata without inventing a page count for reflowable text. */
export function parseReadingMetadata(input: unknown): ReadingFileMetadata {
  return parse(
    v.strictObject({
      format: v.picklist(['epub', 'mobi', 'fb2', 'txt', 'pdf', 'images']),
      pageCount: v.nullable(positiveCount),
    }),
    input,
  )
}

/** Validates a saved access observation and its safe failure explanation. */
export function parseFileAvailability(input: unknown): FileAvailability {
  return parse(
    v.variant('status', [
      v.strictObject({ status: v.literal('unchecked') }),
      v.strictObject({ status: v.literal('accessible'), checkedAt: instant }),
      v.strictObject({
        status: v.literal('unavailable'),
        checkedAt: instant,
        reason: v.picklist(['missing', 'unreadable']),
        error: v.pipe(v.unknown(), v.transform(parseErrorSummary)),
      }),
    ]),
    input,
  )
}

/** Validates a stored playback position in seconds. */
export function parsePlaybackPosition(input: unknown): number {
  return parse(seconds, input)
}

/** Validates one complete playback override, including its independent enablement. */
export function parsePlaybackOverride(input: unknown): UsageOverride<AnimePlaybackPreferences> {
  return parse(
    v.strictObject({
      enabled: v.boolean(),
      settings: v.pipe(v.unknown(), v.transform(parseAnimePlaybackPreferences)),
    }),
    input,
  )
}

/** Validates one complete reading override without merging it with a parent configuration. */
export function parseReadingOverride(input: unknown): UsageOverride<ReadingPreferences> {
  return parse(
    v.strictObject({
      enabled: v.boolean(),
      settings: v.pipe(v.unknown(), v.transform(parseReadingPreferences)),
    }),
    input,
  )
}
