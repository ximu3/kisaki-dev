import * as v from 'valibot'
import { DesktopError, parseErrorSummary } from '@kisaki3/desktop-contracts/errors'
import {
  parseAnimePlaybackPreferences,
  parseReadingPreferences,
  type AnimePlaybackPreferences,
  type ReadingPreferences,
  type UsageOverride,
} from '@kisaki3/desktop-contracts/preferences'
import type {
  AnimeFileMetadata,
  ReadingFileMetadata,
  FileAvailability,
} from '@kisaki3/desktop-contracts/library'

const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0))

const positiveCount = v.pipe(count, v.minValue(1))

const instant = v.pipe(v.number(), v.safeInteger())

const seconds = v.pipe(v.number(), v.finite(), v.minValue(0))

function parse<T>(schema: v.GenericSchema<unknown, T>, input: unknown): T {
  const result = v.safeParse(schema, input)
  if (!result.success) {
    throw new DesktopError('InvalidInput', 'Invalid stored file value')
  }
  return result.output
}

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

export function parseReadingMetadata(input: unknown): ReadingFileMetadata {
  return parse(
    v.strictObject({
      format: v.picklist(['epub', 'mobi', 'fb2', 'txt', 'pdf', 'images']),
      pageCount: v.nullable(positiveCount),
    }),
    input,
  )
}

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

export function parsePlaybackPosition(input: unknown): number {
  return parse(seconds, input)
}

export function parsePlaybackOverride(input: unknown): UsageOverride<AnimePlaybackPreferences> {
  return parse(
    v.strictObject({
      enabled: v.boolean(),
      settings: v.pipe(v.unknown(), v.transform(parseAnimePlaybackPreferences)),
    }),
    input,
  )
}

export function parseReadingOverride(input: unknown): UsageOverride<ReadingPreferences> {
  return parse(
    v.strictObject({
      enabled: v.boolean(),
      settings: v.pipe(v.unknown(), v.transform(parseReadingPreferences)),
    }),
    input,
  )
}
