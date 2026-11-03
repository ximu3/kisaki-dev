/** @fileoverview Owns complete desktop reading/playback preferences independently of media engines and per-file runtime state. */

import * as v from 'valibot'
import { parseTokenValue } from '@kisaki3/desktop-appearance/values'
import { parseLanguageTag } from '../library/catalog'
import { parseFontRef } from '../fonts'
import type { FontRef } from '../fonts'
import {
  nonnegativeNumber,
  optionalFields,
  parseExternalValue,
  parseValue,
  validateExpectedKeys,
} from '../validation'

/** Global panel defaults do not control game launch configuration or current process monitoring. */
export interface GamePreferences {
  readonly showPanelOnStart: boolean
  readonly panelAlwaysOnTop: boolean
}

/** Full playback intent. Specific tracks, sync offsets, remembered volume and temporary speed remain separate. */
export interface AnimePlaybackPreferences {
  readonly audioLanguages: readonly string[]
  readonly subtitleLanguages: readonly string[]
  readonly subtitlesEnabled: boolean

  readonly playbackSpeed: number
  readonly subtitleScale: number

  readonly autoAdvance: boolean
  readonly autoMarkWatched: boolean
}

/** Original-page grouping and display transforms never modify source page identity or pixels. */
export interface ReadingPagePreferences {
  readonly arrangement: 'single' | 'spread'
  readonly progression: 'document' | 'ltr' | 'rtl'
  readonly firstPage: 'single' | 'paired'

  readonly fit: 'page' | 'width' | 'height'
  readonly autoCrop: boolean
  readonly brightness: number
  readonly contrast: number
}

/** Text size/padding are CSS px; line height is a multiplier, paragraph spacing and max line length are base-font em. */
export interface ReadingTextPreferences {
  readonly pagesPerView: 1 | 2
  readonly writingMode: 'document' | 'horizontal-tb' | 'vertical-rl' | 'vertical-lr'

  readonly font: { readonly type: 'document' } | FontRef
  readonly fontSize: number
  readonly lineHeight: number
  readonly paragraphSpacing: 'document' | number
  readonly alignment: 'document' | 'start' | 'justify'

  readonly padding: number
  readonly maxLineLength: number
}

/** Theme/document preserve follow intent; resolved display colors are never written back into this choice. */
export type ReadingColors =
  | { readonly type: 'document' }
  | { readonly type: 'theme' }
  | { readonly type: 'custom'; readonly foreground: string; readonly background: string }

export interface ReadingPreferences {
  readonly flow: 'paginated' | 'continuous'
  readonly pages: ReadingPagePreferences
  readonly text: ReadingTextPreferences
  readonly colors: ReadingColors
}

export interface UsagePreferences {
  readonly foregroundGracePeriodMs: number
  readonly game: GamePreferences
  readonly anime: AnimePlaybackPreferences
  readonly comic: ReadingPreferences
  readonly novel: ReadingPreferences
}

/** Arrays and identity/color choices replace whole values; only the listed native grouping fields admit partial changes. */
export interface ReadingPreferencesChanges {
  readonly flow?: ReadingPreferences['flow']
  readonly pages?: Partial<ReadingPagePreferences>
  readonly text?: Partial<ReadingTextPreferences>
  readonly colors?: ReadingColors
}

export interface UsagePreferencesChanges {
  readonly foregroundGracePeriodMs?: number
  readonly game?: Partial<GamePreferences>
  readonly anime?: Partial<AnimePlaybackPreferences>
  readonly comic?: ReadingPreferencesChanges
  readonly novel?: ReadingPreferencesChanges
}

/** Disabled overrides retain their complete settings. Null belongs to the owning field and means never initialized. */
export interface UsageOverride<T> {
  readonly enabled: boolean
  readonly settings: T
}

/** Initialization creates a complete independent unit; editing an existing one can preserve unrelated concurrent fields. */
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

/** Validate all fields regardless of which layout is currently displayed; valid inactive choices remain intact. */
export function parseReadingPreferences(input: unknown): ReadingPreferences {
  return parseValue(v.strictObject(readingPreferenceEntries), input, 'Invalid reading preferences')
}

/** Apply the same speed/subtitle ranges at every input boundary, without clamping or inferring a language. */
export function parseAnimePlaybackPreferences(input: unknown): AnimePlaybackPreferences {
  return parseValue(
    v.strictObject(playbackPreferenceEntries),
    input,
    'Invalid playback preferences',
  )
}

/** Parse explicit leaf modifications; document/font/color choices remain indivisible values. */
export function parseReadingPreferencesChanges(input: unknown): ReadingPreferencesChanges {
  return parseValue(
    v.strictObject(optionalFields(readingChangeEntries)),
    input,
    'Invalid reading preference changes',
  )
}

/** Check precisely the reading fields edited in this save; no arbitrary recursive paths or baseline expansion. */
export function validateReadingExpected(
  changes: ReadingPreferencesChanges,
  expected: ReadingPreferencesChanges | undefined,
): void {
  validateExpectedKeys(changes, expected)
  validateExpectedKeys(changes.pages ?? {}, expected?.pages)
  validateExpectedKeys(changes.text ?? {}, expected?.text)
}

/** A fresh complete default for either reading medium; callers keep comic and novel selections independently. */
export function getReadingDefaults(): ReadingPreferences {
  return {
    flow: 'paginated',
    pages: {
      arrangement: 'single',
      progression: 'document',
      firstPage: 'single',

      fit: 'page',
      autoCrop: false,
      brightness: 1,
      contrast: 1,
    },
    text: {
      pagesPerView: 1,
      writingMode: 'document',

      font: { type: 'document' },
      fontSize: 20,
      lineHeight: 1.8,
      paragraphSpacing: 'document',
      alignment: 'document',

      padding: 24,
      maxLineLength: 36,
    },
    colors: { type: 'theme' },
  }
}

/** A fresh playback configuration, independent of remembered volume/mute and any opened file. */
export function getAnimePlaybackDefaults(): AnimePlaybackPreferences {
  return {
    audioLanguages: [],
    subtitleLanguages: [],
    subtitlesEnabled: true,

    playbackSpeed: 1,
    subtitleScale: 1,

    autoAdvance: false,
    autoMarkWatched: true,
  }
}

/** All four medium defaults and the single shared foreground grace interval. */
export function getUsageDefaults(): UsagePreferences {
  return {
    foregroundGracePeriodMs: 600_000,
    game: { showPanelOnStart: false, panelAlwaysOnTop: true },
    anime: getAnimePlaybackDefaults(),
    comic: getReadingDefaults(),
    novel: getReadingDefaults(),
  }
}

/** Select one enabled complete snapshot, never a field-by-field merge across global, work and file layers. */
export function selectCompletePreferences<T>(
  global: T,
  work: UsageOverride<T> | null,
  file: UsageOverride<T> | null,
): { readonly source: 'global' | 'work' | 'file'; readonly settings: T } {
  if (file?.enabled) {
    return { source: 'file', settings: file.settings }
  }
  if (work?.enabled) {
    return { source: 'work', settings: work.settings }
  }

  return { source: 'global', settings: global }
}

/** Validate initialize/update intent and field-local baselines without reselecting or copying a current parent. */
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

/** Playback overrides follow the same complete-unit selection rule, with whole ordered language arrays. */
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
