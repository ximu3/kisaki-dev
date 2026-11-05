/** @fileoverview Defines preference snapshots, field navigation and optimistic changes without choosing defaults. */

import type { UiTranslationRef } from '../i18n'
import type { PageRef } from '../ui/pages'
import type { AppearancePreferences } from '../appearance'
import type { UsagePreferences, UsagePreferencesChanges, ReadingPreferences } from './usage'
import type {
  ShortcutsPreferences,
  ShortcutKey,
  ShortcutPreferences,
  DesktopPlatform,
} from './shortcuts'
import type { NetworkPreferences, ProxyCredentials } from '../network'
import type { StoredDefinition, CallOptions, Disposable } from '../operations'
import * as v from 'valibot'
import { parseUiTranslationRef } from '../i18n'
import { parseThemeRef } from '../appearance'
import { parsePageRef } from '../ui/pages'
import {
  unique,
  integer,
  nonnegativeInteger,
  text,
  optionalFields,
  nonnegativeNumber,
  parseValue,
  validateExpectedKeys,
} from '../validation'
import {
  parseProxyEndpoint,
  parseProxyCredentials,
  parseProxyCredentialState,
  parseNetworkPreferences,
} from '../network'
import { parseShortcutPreferences, shortcutKeys, findShortcutConflicts } from './shortcuts'
import {
  gamePreferenceEntries,
  playbackPreferenceEntries,
  readingPreferenceEntries,
  usageChangeEntries,
  readingPageEntries,
  readingTextEntries,
  validateReadingExpected,
} from './usage'
import { DesktopError } from '../errors'

export interface GeneralPreferences {
  readonly uiTranslation: UiTranslationRef
  readonly closeMainWindow: 'background' | 'quit'
}

export interface NavigationPreferences {
  readonly order: readonly PageRef[]
  readonly visibleLimit: number
}

export interface LibraryPreferences {
  readonly showNsfw: boolean
  readonly autoRefreshHoldings: boolean
}

/** Application control memory is separate from a complete per-medium configuration. */
export interface PlaybackPreferences {
  readonly volumePercent: number
  readonly muted: boolean
}

export interface UpdatePreferences {
  readonly autoCheck: boolean
  readonly allowPrerelease: boolean
}

/** Strict complete values used by initialization and explicit defaults. Credentials are read-only state, not plaintext. */
export interface Preferences {
  readonly general: GeneralPreferences
  readonly appearance: AppearancePreferences
  readonly navigation: NavigationPreferences
  readonly library: LibraryPreferences
  readonly usage: UsagePreferences
  readonly playback: PlaybackPreferences
  readonly shortcuts: ShortcutsPreferences
  readonly network: NetworkPreferences
  readonly updates: UpdatePreferences
}

export interface PreferencesChanges {
  readonly general?: Partial<GeneralPreferences>
  readonly appearance?: Partial<AppearancePreferences>
  readonly navigation?: Partial<NavigationPreferences>
  readonly library?: Partial<LibraryPreferences>
  readonly usage?: UsagePreferencesChanges
  readonly playback?: Partial<PlaybackPreferences>
  readonly shortcuts?: Partial<Record<ShortcutKey, Partial<ShortcutPreferences>>>
  readonly network?: Partial<Omit<NetworkPreferences, 'credentials'>> & {
    readonly credentials?: ProxyCredentials | null
  }
  readonly updates?: Partial<UpdatePreferences>
}

/** Credential baselines compare the state returned by get, not a plaintext secret or a whole-row revision. */
export type PreferencesExpected = Omit<PreferencesChanges, 'network'> & {
  readonly network?: Partial<NetworkPreferences>
}

export interface PreferencesUpdate {
  readonly changes: PreferencesChanges
  readonly expected?: PreferencesExpected
}

/** Invalid identities/executable definitions remain unavailable; valid sibling ordinary preferences retain their own values. */
export type ReadingPreferencesSnapshot = Omit<ReadingPreferences, 'text'> & {
  readonly text: Omit<ReadingPreferences['text'], 'font'> & {
    readonly font: StoredDefinition<ReadingPreferences['text']['font']>
  }
}

export type PreferencesSnapshot = Omit<
  Preferences,
  'general' | 'appearance' | 'navigation' | 'usage' | 'shortcuts' | 'network'
> & {
  readonly general: Omit<GeneralPreferences, 'uiTranslation'> & {
    readonly uiTranslation: StoredDefinition<UiTranslationRef>
  }

  readonly appearance: Omit<AppearancePreferences, 'theme'> & {
    readonly theme: StoredDefinition<AppearancePreferences['theme']>
  }

  readonly navigation: Omit<NavigationPreferences, 'order'> & {
    readonly order: StoredDefinition<readonly PageRef[]>
  }

  readonly usage: Omit<UsagePreferences, 'comic' | 'novel'> & {
    readonly comic: ReadingPreferencesSnapshot
    readonly novel: ReadingPreferencesSnapshot
  }

  readonly shortcuts: Readonly<
    Record<
      ShortcutKey,
      { readonly enabled: boolean; readonly accelerators: StoredDefinition<readonly string[]> }
    >
  >

  readonly network: StoredDefinition<NetworkPreferences>
}

export type ReadingPreferenceKey =
  | 'flow'
  | 'colors'
  | `pages.${'arrangement' | 'progression' | 'firstPage' | 'fit' | 'autoCrop' | 'brightness' | 'contrast'}`
  | `text.${'pagesPerView' | 'writingMode' | 'font' | 'fontSize' | 'lineHeight' | 'paragraphSpacing' | 'alignment' | 'padding' | 'maxLineLength'}`

/** Navigation identity only; it never authorizes a JSON-path write. Playback volume/mute are deliberately absent. */
export type PreferenceKey =
  | `general.${keyof GeneralPreferences}`
  | `appearance.${keyof AppearancePreferences}`
  | `navigation.${keyof NavigationPreferences}`
  | `library.${keyof LibraryPreferences}`
  | 'usage.foregroundGracePeriodMs'
  | `usage.game.${keyof UsagePreferences['game']}`
  | `usage.anime.${keyof UsagePreferences['anime']}`
  | `usage.${'comic' | 'novel'}.${ReadingPreferenceKey}`
  | `shortcuts.${ShortcutKey}`
  | `network.${keyof NetworkPreferences}`
  | `updates.${keyof UpdatePreferences}`

/** Text comes from the owning native field catalog after localization, shared with preference search. */
export interface PreferenceField {
  readonly key: PreferenceKey
  readonly name: string
  readonly description: string
  readonly keywords: readonly string[]
}

export interface PreferencesApi {
  /**
   * Read the saved configuration snapshot, retaining unavailable identities and invalid
   * executable definitions as explicit states.
   */
  get(call?: CallOptions): Promise<PreferencesSnapshot>

  /**
   * Read complete defaults for the current application context without modifying saved
   * preferences or a caller's draft.
   */
  getDefaults(call?: CallOptions): Promise<Preferences>

  /** Compare and commit only submitted fields, all-or-nothing. Runtime adoption is a separate observable result. */
  update(input: PreferencesUpdate, call?: CallOptions): Promise<PreferencesSnapshot>

  /**
   * Read localized field navigation and search descriptions; field keys do not authorize
   * arbitrary path writes.
   */
  listFields(call?: CallOptions): Promise<readonly PreferenceField[]>

  /**
   * Subscribe before reading preferences; invalidation requests a fresh snapshot without
   * replacing unsaved edits.
   */
  onInvalidated(listener: () => void): Disposable
}

const translated = v.pipe(v.unknown(), v.transform(parseUiTranslationRef))

const theme = v.pipe(v.unknown(), v.transform(parseThemeRef))

export const order = v.pipe(
  v.array(v.pipe(v.unknown(), v.transform(parsePageRef))),
  v.check((pages) => unique(pages, (page) => JSON.stringify(page))),
)

export const generalEntries = {
  uiTranslation: translated,
  closeMainWindow: v.picklist(['background', 'quit']),
}

export const appearanceEntries = {
  theme,
  mode: v.picklist(['system', 'light', 'dark']),
  interfaceScale: v.pipe(integer, v.minValue(75), v.maxValue(200)),
}

const navigationEntries = { order, visibleLimit: nonnegativeInteger }

export const libraryEntries = { showNsfw: v.boolean(), autoRefreshHoldings: v.boolean() }

export const playbackEntries = {
  volumePercent: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(100)),
  muted: v.boolean(),
}

export const updateEntries = { autoCheck: v.boolean(), allowPrerelease: v.boolean() }

const networkEntries = {
  mode: v.picklist(['system', 'direct', 'manual']),
  endpoint: v.nullable(v.pipe(v.unknown(), v.transform(parseProxyEndpoint))),
  bypassRules: text,
}

export const shortcutFields = {
  enabled: v.boolean(),
  accelerators: v.pipe(
    v.unknown(),
    v.transform(
      (value) => parseShortcutPreferences({ enabled: true, accelerators: value }).accelerators,
    ),
  ),
}

const shortcuts = Object.fromEntries(
  shortcutKeys.map((key): [ShortcutKey, v.GenericSchema<unknown, ShortcutPreferences>] => [
    key,
    v.pipe(v.unknown(), v.transform(parseShortcutPreferences)),
  ]),
) as Record<ShortcutKey, v.GenericSchema<unknown, ShortcutPreferences>>

const shortcutChanges = Object.fromEntries(
  shortcutKeys.map((key) => [key, v.exactOptional(v.strictObject(optionalFields(shortcutFields)))]),
)

const usageEntries = {
  foregroundGracePeriodMs: nonnegativeNumber,
  game: v.strictObject(gamePreferenceEntries),
  anime: v.strictObject(playbackPreferenceEntries),
  comic: v.strictObject(readingPreferenceEntries),
  novel: v.strictObject(readingPreferenceEntries),
}

const changes = {
  general: v.strictObject(optionalFields(generalEntries)),
  appearance: v.strictObject(optionalFields(appearanceEntries)),
  navigation: v.strictObject(optionalFields(navigationEntries)),
  library: v.strictObject(optionalFields(libraryEntries)),
  usage: v.strictObject(optionalFields(usageChangeEntries)),
  playback: v.strictObject(optionalFields(playbackEntries)),
  shortcuts: v.strictObject(shortcutChanges),
  updates: v.strictObject(optionalFields(updateEntries)),
  network: v.strictObject(
    optionalFields({
      ...networkEntries,
      credentials: v.nullable(v.pipe(v.unknown(), v.transform(parseProxyCredentials))),
    }),
  ),
}

const expected = {
  ...changes,
  network: v.strictObject(
    optionalFields({
      ...networkEntries,
      credentials: v.pipe(v.unknown(), v.transform(parseProxyCredentialState)),
    }),
  ),
}

const readingKeys = [
  'flow',
  'colors',
  ...Object.keys(readingPageEntries).map((key) => `pages.${key}`),
  ...Object.keys(readingTextEntries).map((key) => `text.${key}`),
] as readonly ReadingPreferenceKey[]

export const preferenceKeys: readonly PreferenceKey[] = Object.freeze([
  ...Object.keys(generalEntries).map((key) => `general.${key}`),
  ...Object.keys(appearanceEntries).map((key) => `appearance.${key}`),
  ...Object.keys(navigationEntries).map((key) => `navigation.${key}`),
  ...Object.keys(libraryEntries).map((key) => `library.${key}`),
  'usage.foregroundGracePeriodMs',
  ...Object.keys(gamePreferenceEntries).map((key) => `usage.game.${key}`),
  ...Object.keys(playbackPreferenceEntries).map((key) => `usage.anime.${key}`),
  ...(['comic', 'novel'] as const).flatMap((kind) =>
    readingKeys.map((key) => `usage.${kind}.${key}`),
  ),
  ...shortcutKeys.map((key) => `shortcuts.${key}`),
  'network.mode',
  'network.endpoint',
  'network.bypassRules',
  'network.credentials',
  'updates.autoCheck',
  'updates.allowPrerelease',
] as PreferenceKey[])

/** Check a field-navigation reference against the finite current catalog. */
export function parsePreferenceKey(input: unknown): PreferenceKey {
  return parseValue(v.picklist(preferenceKeys), input, 'Invalid preference field')
}

/** Validate complete canonical values and optional platform conflict checks. Actual resource existence is checked by its owner. */
export function parsePreferences(input: unknown, platform?: DesktopPlatform): Preferences {
  const value = parseValue(
    v.strictObject({
      general: v.strictObject(generalEntries),
      appearance: v.strictObject(appearanceEntries),
      navigation: v.strictObject(navigationEntries),
      library: v.strictObject(libraryEntries),
      usage: v.strictObject(usageEntries),
      playback: v.strictObject(playbackEntries),
      shortcuts: v.strictObject(shortcuts),
      network: v.pipe(v.unknown(), v.transform(parseNetworkPreferences)),
      updates: v.strictObject(updateEntries),
    }),
    input,
    'Invalid preferences',
  ) as Preferences
  if (platform && findShortcutConflicts(value.shortcuts, platform).length > 0) {
    throw new DesktopError('InvalidInput', 'Shortcut bindings overlap')
  }

  return value
}

/** No arbitrary recursion/paths: only these native groups permit partial changes; identity choices and arrays replace as units. */
export function parsePreferencesUpdate(input: unknown): PreferencesUpdate {
  const value = parseValue(
    v.strictObject({
      changes: v.strictObject(optionalFields(changes)),
      expected: v.exactOptional(v.strictObject(optionalFields(expected))),
    }),
    input,
    'Invalid preference update',
  ) as PreferencesUpdate
  validateExpectedKeys(value.changes, value.expected)
  for (const key of [
    'general',
    'appearance',
    'navigation',
    'library',
    'playback',
    'network',
    'updates',
    'shortcuts',
  ] as const) {
    validateExpectedKeys(value.changes[key] ?? {}, value.expected?.[key])
  }

  validateExpectedKeys(value.changes.usage ?? {}, value.expected?.usage)
  validateExpectedKeys(value.changes.usage?.game ?? {}, value.expected?.usage?.game)
  validateExpectedKeys(value.changes.usage?.anime ?? {}, value.expected?.usage?.anime)
  validateReadingExpected(value.changes.usage?.comic ?? {}, value.expected?.usage?.comic)
  validateReadingExpected(value.changes.usage?.novel ?? {}, value.expected?.usage?.novel)

  for (const key of shortcutKeys) {
    validateExpectedKeys(value.changes.shortcuts?.[key] ?? {}, value.expected?.shortcuts?.[key])
  }
  if (
    Object.hasOwn(value.changes.network ?? {}, 'credentials') &&
    !Object.hasOwn(value.expected?.network ?? {}, 'credentials')
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Credential changes require the original credential state',
    )
  }

  return value
}
