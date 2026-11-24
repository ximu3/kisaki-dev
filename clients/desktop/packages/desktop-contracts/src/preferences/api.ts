import type { StoredDefinition, CallOptions, Disposable } from '../operations'
import * as v from 'valibot'
import { parseUiTranslationRef, type UiTranslationRef } from '../i18n'
import {
  appearanceModes,
  interfaceScaleRange,
  parseThemeRef,
  type AppearancePreferences,
} from '../appearance'
import { parsePageRef, type PageRef } from '../ui/pages'
import {
  fromParser,
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
  type NetworkPreferences,
  type ProxyCredentials,
} from '../network'
import {
  parseShortcutAccelerators,
  shortcutKeys,
  findShortcutConflicts,
  type ShortcutsPreferences,
  type ShortcutKey,
  type DesktopPlatform,
} from './shortcuts'
import {
  gamePreferenceEntries,
  playbackPreferenceEntries,
  readingPreferenceEntries,
  usageChangeEntries,
  readingPageEntries,
  readingTextEntries,
  validateReadingExpected,
  type UsagePreferences,
  type UsagePreferencesChanges,
  type ReadingPreferences,
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

export interface PlaybackPreferences {
  readonly volumePercent: number
  readonly muted: boolean
}

export interface UpdatePreferences {
  readonly autoCheck: boolean
  readonly allowPrerelease: boolean
}

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
  readonly shortcuts?: Partial<ShortcutsPreferences>
  readonly network?: Partial<Omit<NetworkPreferences, 'credentials'>> & {
    readonly credentials?: ProxyCredentials | null
  }
  readonly updates?: Partial<UpdatePreferences>
}

export type PreferencesExpected = Omit<PreferencesChanges, 'network'> & {
  readonly network?: Partial<NetworkPreferences>
}

export interface PreferencesUpdate {
  readonly changes: PreferencesChanges
  readonly expected?: PreferencesExpected
}

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

  readonly shortcuts: Readonly<Record<ShortcutKey, StoredDefinition<readonly string[]>>>

  readonly network: StoredDefinition<NetworkPreferences>
}

export type ReadingPreferenceKey =
  | Exclude<keyof ReadingPreferences, 'pages' | 'text'>
  | `pages.${keyof ReadingPreferences['pages']}`
  | `text.${keyof ReadingPreferences['text']}`

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

export interface PreferenceField {
  readonly key: PreferenceKey
  readonly name: string
  readonly description: string
  readonly keywords: readonly string[]
}

export interface PreferencesApi {
  get(call?: CallOptions): Promise<PreferencesSnapshot>

  getDefaults(call?: CallOptions): Promise<Preferences>

  update(input: PreferencesUpdate, call?: CallOptions): Promise<PreferencesSnapshot>

  listFields(call?: CallOptions): Promise<readonly PreferenceField[]>

  onInvalidated(listener: () => void): Disposable
}

const translated = fromParser(parseUiTranslationRef)

const theme = fromParser(parseThemeRef)

export const order = v.pipe(
  v.array(fromParser(parsePageRef)),
  v.check((pages) => unique(pages, (page) => JSON.stringify(page))),
)

export const generalEntries = {
  uiTranslation: translated,
  closeMainWindow: v.picklist(['background', 'quit']),
}

export const appearanceEntries = {
  theme,
  mode: v.picklist(appearanceModes),
  interfaceScale: v.pipe(
    integer,
    v.minValue(interfaceScaleRange.min),
    v.maxValue(interfaceScaleRange.max),
  ),
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
  endpoint: v.nullable(fromParser(parseProxyEndpoint)),
  bypassRules: text,
}

const shortcutAccelerators = fromParser(parseShortcutAccelerators)

const shortcuts = Object.fromEntries(
  shortcutKeys.map((key) => [key, shortcutAccelerators]),
) as Record<ShortcutKey, typeof shortcutAccelerators>

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
  shortcuts: v.strictObject(optionalFields(shortcuts)),
  updates: v.strictObject(optionalFields(updateEntries)),
  network: v.strictObject(
    optionalFields({
      ...networkEntries,
      credentials: v.nullable(fromParser(parseProxyCredentials)),
    }),
  ),
}

const expected = {
  ...changes,
  network: v.strictObject(
    optionalFields({
      ...networkEntries,
      credentials: fromParser(parseProxyCredentialState),
    }),
  ),
}

function fieldKeys<Prefix extends string, Fields extends object>(
  prefix: Prefix,
  fields: Fields,
): `${Prefix}.${keyof Fields & string}`[] {
  return Object.keys(fields).map((key) => `${prefix}.${key as keyof Fields & string}` as const)
}

function readingKeys<Medium extends 'comic' | 'novel'>(medium: Medium) {
  return [
    `usage.${medium}.flow`,
    `usage.${medium}.colors`,
    ...fieldKeys(`usage.${medium}.pages`, readingPageEntries),
    ...fieldKeys(`usage.${medium}.text`, readingTextEntries),
  ] as const
}

export const preferenceKeys: readonly PreferenceKey[] = Object.freeze([
  ...fieldKeys('general', generalEntries),
  ...fieldKeys('appearance', appearanceEntries),
  ...fieldKeys('navigation', navigationEntries),
  ...fieldKeys('library', libraryEntries),
  'usage.foregroundGracePeriodMs',
  ...fieldKeys('usage.game', gamePreferenceEntries),
  ...fieldKeys('usage.anime', playbackPreferenceEntries),
  ...readingKeys('comic'),
  ...readingKeys('novel'),
  ...fieldKeys('shortcuts', shortcuts),
  ...fieldKeys('network', networkEntries),
  'network.credentials',
  ...fieldKeys('updates', updateEntries),
] satisfies PreferenceKey[])

export function parsePreferenceKey(input: unknown): PreferenceKey {
  return parseValue(v.picklist(preferenceKeys), input, 'Invalid preference field')
}

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
      network: fromParser(parseNetworkPreferences),
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

export function effectiveShortcutBindings(
  saved: PreferencesSnapshot['shortcuts'],
  edits?: PreferencesChanges['shortcuts'],
): ShortcutsPreferences {
  return Object.fromEntries(
    shortcutKeys.map((key) => {
      const original = saved[key]
      return [key, edits?.[key] ?? (original.status === 'ready' ? original.value : [])]
    }),
  ) as ShortcutsPreferences
}

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
