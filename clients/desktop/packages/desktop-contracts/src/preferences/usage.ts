/** @fileoverview Owns complete desktop reading/playback preferences independently of media engines and per-file runtime state. */

import type { FontRef } from '../fonts'
import * as v from 'valibot'
import { parseLanguageTag } from '../library/catalog'
import {
  nonnegativeNumber,
  parseValue,
  parseExternalValue,
  optionalFields,
  validateExpectedKeys,
} from '../validation'
import { parseFontRef } from '../fonts'
import { parseTokenValue } from '@kisaki3/desktop-appearance/values'

/** Global defaults for game-panel visibility and always-on-top behavior. */
export interface GamePreferences {
  readonly showPanelOnStart: boolean
  readonly panelAlwaysOnTop: boolean
}

/**
 * Complete playback preferences selected as one configuration unit.
 *
 * Specific tracks, synchronization offsets, remembered volume and temporary speed have separate
 * owners.
 */
export interface AnimePlaybackPreferences {
  /** Preferred audio languages in priority order; an empty list expresses no preference. */
  readonly audioLanguages: readonly string[]
  /** Preferred subtitle languages in priority order; an empty list expresses no preference. */
  readonly subtitleLanguages: readonly string[]
  readonly subtitlesEnabled: boolean

  /** Playback-rate multiplier, from 0.01 through 100. */
  readonly playbackSpeed: number
  /** Positive subtitle-size multiplier, at most 100. */
  readonly subtitleScale: number

  readonly autoAdvance: boolean
  readonly autoMarkWatched: boolean
}

/** Original-page grouping and display transforms independent of source page identity and pixels. */
export interface ReadingPagePreferences {
  readonly arrangement: 'single' | 'spread'
  readonly progression: 'document' | 'ltr' | 'rtl'
  readonly firstPage: 'single' | 'paired'

  readonly fit: 'page' | 'width' | 'height'
  readonly autoCrop: boolean
  /** Display brightness multiplier from 0 through 2, with 1 preserving the original brightness. */
  readonly brightness: number
  /** Display contrast multiplier from 0 through 2, with 1 preserving the original contrast. */
  readonly contrast: number
}

/** Text layout, font and spacing preferences for reflowable content. */
export interface ReadingTextPreferences {
  readonly pagesPerView: 1 | 2
  readonly writingMode: 'document' | 'horizontal-tb' | 'vertical-rl' | 'vertical-lr'

  readonly font: { readonly type: 'document' } | FontRef
  /** Base text size in CSS pixels. */
  readonly fontSize: number
  /** Positive line-height multiplier. */
  readonly lineHeight: number
  /** Document spacing or a nonnegative distance in base-font em units. */
  readonly paragraphSpacing: 'document' | number
  readonly alignment: 'document' | 'start' | 'justify'

  /** Content padding in CSS pixels. */
  readonly padding: number
  /** Maximum line length in base-font em units. */
  readonly maxLineLength: number
}

/**
 * Saved intent to use document, theme or explicit reading colors.
 *
 * Resolved display colors are not written back into a document or theme choice.
 */
export type ReadingColors =
  | { readonly type: 'document' }
  | { readonly type: 'theme' }
  | { readonly type: 'custom'; readonly foreground: string; readonly background: string }

/** Complete reading configuration covering flow, original pages, reflowable text and colors. */
export interface ReadingPreferences {
  readonly flow: 'paginated' | 'continuous'
  readonly pages: ReadingPagePreferences
  readonly text: ReadingTextPreferences
  readonly colors: ReadingColors
}

/** Global timing grace period and per-medium usage defaults. */
export interface UsagePreferences {
  readonly foregroundGracePeriodMs: number
  readonly game: GamePreferences
  readonly anime: AnimePlaybackPreferences
  readonly comic: ReadingPreferences
  readonly novel: ReadingPreferences
}

/**
 * Reading edits grouped by native page and text settings.
 *
 * Font and color choices replace as complete values.
 */
export interface ReadingPreferencesChanges {
  readonly flow?: ReadingPreferences['flow']
  readonly pages?: Partial<ReadingPagePreferences>
  readonly text?: Partial<ReadingTextPreferences>
  readonly colors?: ReadingColors
}

/** Partial timing and per-medium preference edits at their declared field boundaries. */
export interface UsagePreferencesChanges {
  readonly foregroundGracePeriodMs?: number
  readonly game?: Partial<GamePreferences>
  readonly anime?: Partial<AnimePlaybackPreferences>
  readonly comic?: ReadingPreferencesChanges
  readonly novel?: ReadingPreferencesChanges
}

/**
 * Initialized independent usage configuration with explicit enabled state.
 *
 * Disabling retains complete settings. A null value in the owning field means the override has
 * never been initialized.
 */
export interface UsageOverride<T> {
  readonly enabled: boolean
  readonly settings: T
}

/**
 * Reading-override initialization or field-specific update with optional original values.
 *
 * Initialization supplies a complete independent unit; later edits preserve unrelated fields.
 */
export type ReadingOverrideChange =
  | {
      readonly type: 'initialize'
      readonly enabled: boolean
      readonly settings: ReadingPreferences
    }
  | {
      readonly type: 'update'
      readonly changes: {
        readonly enabled?: boolean
        readonly settings?: ReadingPreferencesChanges
      }
      readonly expected?: {
        readonly enabled?: boolean
        readonly settings?: ReadingPreferencesChanges
      }
    }

/** Playback-override initialization or field-specific update with optional original values. */
export type PlaybackOverrideChange =
  | {
      readonly type: 'initialize'
      readonly enabled: boolean
      readonly settings: AnimePlaybackPreferences
    }
  | {
      readonly type: 'update'
      readonly changes: {
        readonly enabled?: boolean
        readonly settings?: Partial<AnimePlaybackPreferences>
      }
      readonly expected?: {
        readonly enabled?: boolean
        readonly settings?: Partial<AnimePlaybackPreferences>
      }
    }

const positive = v.pipe(v.number(), v.finite(), v.gtValue(0))

const languageList = v.pipe(
  v.array(v.pipe(v.unknown(), v.transform(parseLanguageTag))),
  v.transform((values) => [...new Set(values)]),
)

export const gamePreferenceEntries = {
  showPanelOnStart: v.boolean(),
  panelAlwaysOnTop: v.boolean(),
}

export const playbackPreferenceEntries = {
  audioLanguages: languageList,
  subtitleLanguages: languageList,
  subtitlesEnabled: v.boolean(),

  playbackSpeed: v.pipe(v.number(), v.finite(), v.minValue(0.01), v.maxValue(100)),
  subtitleScale: v.pipe(positive, v.maxValue(100)),

  autoAdvance: v.boolean(),
  autoMarkWatched: v.boolean(),
}

export const readingPageEntries = {
  arrangement: v.picklist(['single', 'spread']),
  progression: v.picklist(['document', 'ltr', 'rtl']),
  firstPage: v.picklist(['single', 'paired']),

  fit: v.picklist(['page', 'width', 'height']),
  autoCrop: v.boolean(),
  brightness: v.pipe(nonnegativeNumber, v.maxValue(2)),
  contrast: v.pipe(nonnegativeNumber, v.maxValue(2)),
}

const readingFont = v.pipe(
  v.unknown(),
  v.transform((value): ReadingTextPreferences['font'] => {
    if (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      value.type === 'document'
    ) {
      return parseValue(v.strictObject({ type: v.literal('document') }), value)
    }

    return parseFontRef(value)
  }),
)

export const readingTextEntries = {
  pagesPerView: v.union([v.literal(1), v.literal(2)]),
  writingMode: v.picklist(['document', 'horizontal-tb', 'vertical-rl', 'vertical-lr']),

  font: readingFont,
  fontSize: positive,
  lineHeight: positive,
  paragraphSpacing: v.union([v.literal('document'), nonnegativeNumber]),
  alignment: v.picklist(['document', 'start', 'justify']),

  padding: nonnegativeNumber,
  maxLineLength: positive,
}

/** Creates a reading-color schema using the owning appearance token parser. */
function color(token: '--foreground' | '--background') {
  return v.pipe(
    v.unknown(),
    v.transform((value) =>
      parseExternalValue((input) => parseTokenValue(token, input), value, 'Invalid reading color'),
    ),
  )
}

const colors = v.variant('type', [
  v.strictObject({ type: v.literal('document') }),
  v.strictObject({ type: v.literal('theme') }),
  v.strictObject({
    type: v.literal('custom'),
    foreground: color('--foreground'),
    background: color('--background'),
  }),
])

export const readingPreferenceEntries = {
  flow: v.picklist(['paginated', 'continuous']),
  pages: v.strictObject(readingPageEntries),
  text: v.strictObject(readingTextEntries),
  colors,
}

export const readingChangeEntries = {
  flow: readingPreferenceEntries.flow,
  pages: v.strictObject(optionalFields(readingPageEntries)),
  text: v.strictObject(optionalFields(readingTextEntries)),
  colors,
}

export const usageChangeEntries = {
  foregroundGracePeriodMs: nonnegativeNumber,
  game: v.strictObject(optionalFields(gamePreferenceEntries)),
  anime: v.strictObject(optionalFields(playbackPreferenceEntries)),
  comic: v.strictObject(optionalFields(readingChangeEntries)),
  novel: v.strictObject(optionalFields(readingChangeEntries)),
}

/** Parses all reading settings, including those inactive in the current layout. */
export function parseReadingPreferences(input: unknown): ReadingPreferences {
  return parseValue(v.strictObject(readingPreferenceEntries), input, 'Invalid reading preferences')
}

/**
 * Parses playback preferences using the shared speed, subtitle and language constraints.
 *
 * Values are validated rather than clamped.
 */
export function parseAnimePlaybackPreferences(input: unknown): AnimePlaybackPreferences {
  return parseValue(
    v.strictObject(playbackPreferenceEntries),
    input,
    'Invalid playback preferences',
  )
}

/** Parses explicit reading edits while retaining font and color choices as indivisible values. */
export function parseReadingPreferencesChanges(input: unknown): ReadingPreferencesChanges {
  return parseValue(
    v.strictObject(optionalFields(readingChangeEntries)),
    input,
    'Invalid reading preference changes',
  )
}

/** Checks that reading baselines refer only to fields submitted in the current edit. */
export function validateReadingExpected(
  changes: ReadingPreferencesChanges,
  expected: ReadingPreferencesChanges | undefined,
): void {
  validateExpectedKeys(changes, expected)
  validateExpectedKeys(changes.pages ?? {}, expected?.pages)
  validateExpectedKeys(changes.text ?? {}, expected?.text)
}

/** Parses complete initialization or partial reading-override edits and their field baselines. */
export function parseReadingOverrideChange(input: unknown): ReadingOverrideChange {
  const update = v.strictObject(
    optionalFields({
      enabled: v.boolean(),
      settings: v.strictObject(optionalFields(readingChangeEntries)),
    }),
  )
  const value = parseValue(
    v.variant('type', [
      v.strictObject({
        type: v.literal('initialize'),
        enabled: v.boolean(),
        settings: v.strictObject(readingPreferenceEntries),
      }),
      v.strictObject({
        type: v.literal('update'),
        changes: update,
        expected: v.exactOptional(update),
      }),
    ]),
    input,
    'Invalid reading override',
  )
  if (value.type === 'update') {
    validateExpectedKeys(value.changes, value.expected)
    validateReadingExpected(value.changes.settings ?? {}, value.expected?.settings)
  }
  return value
}

/**
 * Parses complete initialization or partial playback-override edits and their field baselines.
 *
 * Ordered language lists replace as whole values.
 */
export function parsePlaybackOverrideChange(input: unknown): PlaybackOverrideChange {
  const update = v.strictObject(
    optionalFields({
      enabled: v.boolean(),
      settings: v.strictObject(optionalFields(playbackPreferenceEntries)),
    }),
  )
  const value = parseValue(
    v.variant('type', [
      v.strictObject({
        type: v.literal('initialize'),
        enabled: v.boolean(),
        settings: v.strictObject(playbackPreferenceEntries),
      }),
      v.strictObject({
        type: v.literal('update'),
        changes: update,
        expected: v.exactOptional(update),
      }),
    ]),
    input,
    'Invalid playback override',
  )
  if (value.type === 'update') {
    validateExpectedKeys(value.changes, value.expected)
    validateExpectedKeys(value.changes.settings ?? {}, value.expected?.settings)
  }
  return value
}
