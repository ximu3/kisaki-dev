/** @fileoverview Owns desktop preference values, complete defaults, and closed related-field updates. */

import * as v from 'valibot'
import { parseVisualToken } from '@kisaki3/appearance'
import { parseLanguageTag } from '@kisaki3/extension-distribution/metadata'
import { themeRefSchema, type AppearancePreferences } from './appearance'
import type { DefinitionRead } from './definition'
import { invalidInput } from './errors'
import type { CallOptions, Disposable } from './execution'
import { fontRefSchema, type FontRef } from './fonts'
import { uiTranslationRefSchema, type UiTranslationRef } from './i18n'
import { objectSchema } from './schema'
import { pageRefSchema, type PageRef } from './ui/pages'
import {
  exactPartialEntries,
  hasRelatedExpected,
  nonemptyStringSchema,
  nonnegativeIntegerSchema,
  nonnegativeNumberSchema,
  parseContract,
  type FieldSchemas,
} from './validation'

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
export interface GamePreferences {
  readonly showPanelOnStart: boolean
  readonly panelAlwaysOnTop: boolean
}
/** Complete playback defaults; temporary runtime speed and application volume/mute are separate. */
export interface AnimePlaybackPreferences {
  readonly audioLanguages: readonly string[]
  readonly subtitleLanguages: readonly string[]
  readonly subtitlesEnabled: boolean
  readonly playbackSpeed: number
  readonly subtitleScale: number
  readonly autoAdvance: boolean
  readonly autoMarkWatched: boolean
}
/** Kisaki's own persistent reading choices, independent of an engine's technical settings. */
export interface ReadingPreferences {
  readonly flow: 'paginated' | 'continuous'
  readonly pages: {
    readonly arrangement: 'single' | 'spread'
    readonly progression: 'document' | 'ltr' | 'rtl'
    readonly firstPage: 'single' | 'paired'
    readonly fit: 'page' | 'width' | 'height'
    readonly autoCrop: boolean
    readonly brightness: number
    readonly contrast: number
  }
  readonly text: {
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
  readonly colors:
    | { readonly type: 'document' | 'theme' }
    | { readonly type: 'custom'; readonly foreground: string; readonly background: string }
}
export interface UsagePreferences {
  readonly foregroundGracePeriodMs: number
  readonly game: GamePreferences
  readonly anime: AnimePlaybackPreferences
  readonly comic: ReadingPreferences
  readonly novel: ReadingPreferences
}
/** Last explicit application volume/mute choices; each open player has its own adopted runtime state. */
export interface PlaybackPreferences {
  readonly volumePercent: number
  readonly muted: boolean
}
export const shortcutKeys = [
  'main.search',
  'main.preferences',
  'editor.save',
  'reader.find',
  'reader.left',
  'reader.right',
  'reader.up',
  'reader.down',
  'reader.previous',
  'reader.next',
  'reader.fullscreen',
  'reader.addAnnotation',
  'reader.toggleAnnotations',
  'reader.toggleTiming',
  'reader.viewWork',
  'player.playPause',
  'player.seekBackward',
  'player.seekForward',
  'player.volumeUp',
  'player.volumeDown',
  'player.toggleMute',
  'player.toggleSubtitles',
  'player.fullscreen',
  'player.addAnnotation',
  'player.toggleAnnotations',
  'player.toggleTiming',
  'player.viewWork',
  'game.addAnnotation',
  'game.toggleAnnotations',
  'game.togglePanel',
  'game.toggleTiming',
  'game.viewWork',
] as const
export type ShortcutKey = (typeof shortcutKeys)[number]
export interface ShortcutBinding {
  readonly enabled: boolean
  readonly accelerators: readonly string[]
}
/** A local credential revision is a comparison value, never a password or a claim of remote authorization. */
export type ProxyCredentialState = { readonly revision: string } | null
export interface ProxyCredentials {
  readonly username: string
  readonly password: string
}
/** A single HTTP(S)/SOCKS5 URL; credentials are stored separately and never embedded in endpoint. */
export interface NetworkPreferences {
  readonly mode: 'system' | 'direct' | 'manual'
  readonly endpoint: string | null
  readonly bypassRules: string
  readonly credentials: ProxyCredentialState
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
  readonly shortcuts: Readonly<Record<ShortcutKey, ShortcutBinding>>
  readonly network: NetworkPreferences
  readonly updates: UpdatePreferences
}

/** Resource/configuration parse failure is explicit; ordinary independently defaultable fields stay readable. */
export type PreferencesRead = Omit<
  Preferences,
  'general' | 'appearance' | 'navigation' | 'usage' | 'network'
> & {
  readonly general: Omit<GeneralPreferences, 'uiTranslation'> & {
    readonly uiTranslation: DefinitionRead<UiTranslationRef>
  }
  readonly appearance: Omit<AppearancePreferences, 'theme'> & {
    readonly theme: DefinitionRead<AppearancePreferences['theme']>
  }
  readonly navigation: Omit<NavigationPreferences, 'order'> & {
    readonly order: DefinitionRead<readonly PageRef[]>
  }
  readonly usage: Omit<UsagePreferences, 'comic' | 'novel'> & {
    readonly comic: ReadingPreferencesRead
    readonly novel: ReadingPreferencesRead
  }
  readonly network: DefinitionRead<NetworkPreferences>
}
/** A bad font choice or color definition is not confused with an unselected or temporarily missing resource. */
export type ReadingPreferencesRead = Omit<ReadingPreferences, 'text' | 'colors'> & {
  readonly text: Omit<ReadingPreferences['text'], 'font'> & {
    readonly font: DefinitionRead<ReadingPreferences['text']['font']>
  }
  readonly colors: DefinitionRead<ReadingPreferences['colors']>
}
export type ReadingPreferenceChanges = Partial<Pick<ReadingPreferences, 'flow' | 'colors'>> & {
  readonly pages?: Partial<ReadingPreferences['pages']>
  readonly text?: Partial<ReadingPreferences['text']>
}
/** Closed nested fields, with whole arrays and references. This is not an arbitrary recursive JSON patch. */
export interface PreferenceChanges {
  readonly general?: Partial<GeneralPreferences>
  readonly appearance?: Partial<AppearancePreferences>
  readonly navigation?: Partial<NavigationPreferences>
  readonly library?: Partial<LibraryPreferences>
  readonly usage?: {
    readonly foregroundGracePeriodMs?: number
    readonly game?: Partial<GamePreferences>
    readonly anime?: Partial<AnimePlaybackPreferences>
    readonly comic?: ReadingPreferenceChanges
    readonly novel?: ReadingPreferenceChanges
  }
  readonly playback?: Partial<PlaybackPreferences>
  readonly shortcuts?: Readonly<Partial<Record<ShortcutKey, Partial<ShortcutBinding>>>>
  readonly network?: Partial<Omit<NetworkPreferences, 'credentials'>> & {
    readonly credentials?: ProxyCredentials | null
  }
  readonly updates?: Partial<UpdatePreferences>
}
export type PreferenceExpected = Omit<PreferenceChanges, 'network'> & {
  readonly network?: Partial<NetworkPreferences>
}
export interface PreferenceUpdate {
  readonly changes: PreferenceChanges
  readonly expected?: PreferenceExpected
}
export type ReadingPreferenceKey =
  | 'flow'
  | 'colors'
  | `pages.${keyof ReadingPreferences['pages']}`
  | `text.${keyof ReadingPreferences['text']}`
export type PreferenceKey =
  | `general.${keyof GeneralPreferences}`
  | `appearance.${keyof AppearancePreferences}`
  | `navigation.${keyof NavigationPreferences}`
  | `library.${keyof LibraryPreferences}`
  | 'usage.foregroundGracePeriodMs'
  | `usage.game.${keyof GamePreferences}`
  | `usage.anime.${keyof AnimePlaybackPreferences}`
  | `usage.${'comic' | 'novel'}.${ReadingPreferenceKey}`
  | `shortcuts.${ShortcutKey}`
  | `network.${keyof NetworkPreferences}`
  | `updates.${keyof UpdatePreferences}`

/** Preferences save intent; actual network, appearance, and player adoption are separately owned. */
export interface PreferencesApi {
  /** Read saved choices under their individual read policies without repairing storage. */
  get(call?: CallOptions): Promise<PreferencesRead>
  /** Read current defaults for this actual platform and native navigation catalog, without writing them. */
  getDefaults(call?: CallOptions): Promise<Preferences>
  /** Compare only related field baselines, save once, then return the actual resulting read snapshot. */
  update(input: PreferenceUpdate, call?: CallOptions): Promise<PreferencesRead>
  /** Observe formal preference invalidation, not an editor's draft values. */
  onInvalidated(listener: () => void): Disposable
}

const positiveNumber = v.pipe(
  nonnegativeNumberSchema,
  v.check((value) => value > 0),
)
const language = v.pipe(
  v.string(),
  v.check((value) => {
    try {
      parseLanguageTag(value)
      return true
    } catch {
      return false
    }
  }),
  v.transform((value) => parseLanguageTag(value)),
)
const languages = v.pipe(
  v.array(language),
  v.transform((values) => [...new Set(values)]),
  v.readonly(),
)
const color = v.pipe(
  v.string(),
  v.check((value) => {
    try {
      parseVisualToken('--foreground', value)
      return true
    } catch {
      return false
    }
  }),
)
const readingPageFields = {
  arrangement: v.picklist(['single', 'spread']),
  progression: v.picklist(['document', 'ltr', 'rtl']),
  firstPage: v.picklist(['single', 'paired']),
  fit: v.picklist(['page', 'width', 'height']),
  autoCrop: v.boolean(),
  brightness: v.pipe(nonnegativeNumberSchema, v.maxValue(2)),
  contrast: v.pipe(nonnegativeNumberSchema, v.maxValue(2)),
} satisfies FieldSchemas<ReadingPreferences['pages']>
const readingTextFields = {
  pagesPerView: v.picklist([1, 2]),
  writingMode: v.picklist(['document', 'horizontal-tb', 'vertical-rl', 'vertical-lr']),
  font: v.union([objectSchema({ type: v.literal('document') }), fontRefSchema]),
  fontSize: positiveNumber,
  lineHeight: positiveNumber,
  paragraphSpacing: v.union([v.literal('document'), nonnegativeNumberSchema]),
  alignment: v.picklist(['document', 'start', 'justify']),
  padding: nonnegativeNumberSchema,
  maxLineLength: positiveNumber,
} satisfies FieldSchemas<ReadingPreferences['text']>
const readingFields = {
  flow: v.picklist(['paginated', 'continuous']),
  pages: objectSchema(readingPageFields),
  text: objectSchema(readingTextFields),
  colors: v.union([
    objectSchema({ type: v.picklist(['document', 'theme']) }),
    objectSchema({ type: v.literal('custom'), foreground: color, background: color }),
  ]),
} satisfies FieldSchemas<ReadingPreferences>
const animeFields = {
  audioLanguages: languages,
  subtitleLanguages: languages,
  subtitlesEnabled: v.boolean(),
  playbackSpeed: v.pipe(positiveNumber, v.minValue(0.01), v.maxValue(100)),
  subtitleScale: v.pipe(positiveNumber, v.maxValue(100)),
  autoAdvance: v.boolean(),
  autoMarkWatched: v.boolean(),
} satisfies FieldSchemas<AnimePlaybackPreferences>
const generalFields = {
  uiTranslation: uiTranslationRefSchema,
  closeMainWindow: v.picklist(['background', 'quit']),
} satisfies FieldSchemas<GeneralPreferences>
const appearanceFields = {
  theme: themeRefSchema,
  mode: v.picklist(['system', 'light', 'dark']),
  interfaceScale: v.pipe(nonnegativeIntegerSchema, v.minValue(75), v.maxValue(200)),
} satisfies FieldSchemas<AppearancePreferences>
const navigationFields = {
  order: v.pipe(
    v.array(pageRefSchema),
    v.check(
      (values) => new Set(values.map((value) => JSON.stringify(value))).size === values.length,
    ),
    v.readonly(),
  ),
  visibleLimit: nonnegativeIntegerSchema,
} satisfies FieldSchemas<NavigationPreferences>
const libraryFields = {
  showNsfw: v.boolean(),
  autoRefreshHoldings: v.boolean(),
} satisfies FieldSchemas<LibraryPreferences>
const gameFields = {
  showPanelOnStart: v.boolean(),
  panelAlwaysOnTop: v.boolean(),
} satisfies FieldSchemas<GamePreferences>
const playbackFields = {
  volumePercent: v.pipe(nonnegativeNumberSchema, v.maxValue(100)),
  muted: v.boolean(),
} satisfies FieldSchemas<PlaybackPreferences>
const updateFields = {
  autoCheck: v.boolean(),
  allowPrerelease: v.boolean(),
} satisfies FieldSchemas<UpdatePreferences>
const credentialState = v.nullable(objectSchema({ revision: nonemptyStringSchema }))
const endpoint = v.nullable(v.pipe(v.string(), v.check(isProxyEndpoint)))
const networkFields = {
  mode: v.picklist(['system', 'direct', 'manual']),
  endpoint,
  bypassRules: v.string(),
  credentials: credentialState,
} satisfies FieldSchemas<NetworkPreferences>
const shortcutFields = {
  enabled: v.boolean(),
  accelerators: v.pipe(
    v.array(
      v.pipe(
        v.string(),
        v.check((value) => {
          try {
            parseAccelerator(value)
            return true
          } catch {
            return false
          }
        }),
      ),
    ),
    v.transform((values) => {
      const seen = new Set<string>()
      return values.filter((value) => {
        const identity = acceleratorIdentity(value)
        if (seen.has(identity)) {
          return false
        }
        seen.add(identity)
        return true
      })
    }),
    v.readonly(),
  ),
} satisfies FieldSchemas<ShortcutBinding>

/** Validate complete Kisaki reading choices without taking defaults or field types from an engine. */
export function parseReadingPreferences(input: unknown): ReadingPreferences {
  return parseContract(objectSchema(readingFields), input, 'reading preferences')
}
/** Validate actual playback default values; out-of-range values are rejected rather than clamped. */
export function parseAnimePlaybackPreferences(input: unknown): AnimePlaybackPreferences {
  return parseContract(objectSchema(animeFields), input, 'anime playback preferences')
}

/** Return fresh defaults; callers supply real platform and catalog facts instead of this pure package guessing them. */
export function createDefaultPreferences(context: {
  readonly platform: 'windows' | 'macos' | 'linux'
  readonly nativePages: readonly Extract<PageRef, { type: 'native' }>[]
}): Preferences {
  const fullscreen = context.platform === 'macos' ? 'Control+Command+F' : 'F11'
  const shortcuts: Preferences['shortcuts'] = {
    'main.search': binding('CommandOrControl+Shift+F'),
    'main.preferences': binding('CommandOrControl+,'),
    'editor.save': binding('CommandOrControl+S'),
    'reader.find': binding('CommandOrControl+F'),
    'reader.left': binding('Left'),
    'reader.right': binding('Right'),
    'reader.up': binding('Up'),
    'reader.down': binding('Down'),
    'reader.previous': binding('PageUp', 'Shift+Space'),
    'reader.next': binding('PageDown', 'Space'),
    'reader.fullscreen': binding(fullscreen),
    'reader.addAnnotation': binding('CommandOrControl+Shift+A'),
    'reader.toggleAnnotations': binding('CommandOrControl+Shift+L'),
    'reader.toggleTiming': binding(),
    'reader.viewWork': binding(),
    'player.fullscreen': binding(fullscreen),
    'player.playPause': binding('Space'),
    'player.seekBackward': binding('Left'),
    'player.seekForward': binding('Right'),
    'player.volumeUp': binding('Up'),
    'player.volumeDown': binding('Down'),
    'player.toggleMute': binding('M'),
    'player.toggleSubtitles': binding('V'),
    'player.addAnnotation': binding('CommandOrControl+Shift+A'),
    'player.toggleAnnotations': binding('CommandOrControl+Shift+L'),
    'player.toggleTiming': binding(),
    'player.viewWork': binding(),
    'game.togglePanel': binding('Shift+F8'),
    'game.addAnnotation': binding('Shift+F9'),
    'game.toggleAnnotations': binding(),
    'game.toggleTiming': binding(),
    'game.viewWork': binding(),
  }
  return {
    general: { uiTranslation: { type: 'builtin', id: 'en' }, closeMainWindow: 'background' },
    appearance: { theme: { type: 'builtin', id: 'default' }, mode: 'system', interfaceScale: 100 },
    navigation: { order: context.nativePages.map((page) => ({ ...page })), visibleLimit: 7 },
    library: { showNsfw: true, autoRefreshHoldings: true },
    usage: {
      foregroundGracePeriodMs: 600_000,
      game: { showPanelOnStart: false, panelAlwaysOnTop: true },
      anime: {
        audioLanguages: [],
        subtitleLanguages: [],
        subtitlesEnabled: true,
        playbackSpeed: 1,
        subtitleScale: 1,
        autoAdvance: false,
        autoMarkWatched: true,
      },
      comic: defaultReadingPreferences(),
      novel: defaultReadingPreferences(),
    },
    playback: { volumePercent: 100, muted: false },
    shortcuts,
    network: { mode: 'system', endpoint: null, bypassRules: '', credentials: null },
    updates: { autoCheck: true, allowPrerelease: false },
  }
}

function binding(...accelerators: string[]): ShortcutBinding {
  return { enabled: true, accelerators }
}

function defaultReadingPreferences(): ReadingPreferences {
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

/** Check one Electron accelerator's documented syntax, preserving the user's actual modifier choice. */
export function parseAccelerator(input: unknown): string {
  const text = parseContract(nonemptyStringSchema, input, 'accelerator')
  const parts = text.split('+')
  let key = parts.pop()!
  if (key === '' && parts.at(-1) === '') {
    parts.pop()
    key = 'Plus'
  }
  const modifiers = new Set([
    'command',
    'cmd',
    'control',
    'ctrl',
    'commandorcontrol',
    'cmdorctrl',
    'alt',
    'option',
    'altgr',
    'shift',
    'super',
    'meta',
  ])
  const keys = new Set([
    'plus',
    'space',
    'tab',
    'capslock',
    'numlock',
    'scrolllock',
    'backspace',
    'delete',
    'insert',
    'return',
    'enter',
    'up',
    'down',
    'left',
    'right',
    'home',
    'end',
    'pageup',
    'pagedown',
    'escape',
    'esc',
    'volumeup',
    'volumedown',
    'volumemute',
    'medianexttrack',
    'mediaprevioustrack',
    'mediastop',
    'mediaplaypause',
    'printscreen',
    'numdec',
    'numadd',
    'numsub',
    'nummult',
    'numdiv',
  ])
  const lower = key.toLowerCase()
  const punctuation = ')!@#$%^&*(:;+=<,_->.?/~`{}[]|\\"'
  if (
    !parts.every((part) => modifiers.has(part.toLowerCase())) ||
    !(
      keys.has(lower) ||
      /^[a-z0-9]$/i.test(key) ||
      /^f(?:[1-9]|1[0-9]|2[0-4])$/i.test(key) ||
      /^num[0-9]$/i.test(key) ||
      (key.length === 1 && punctuation.includes(key))
    )
  ) {
    return invalidInput('Invalid accelerator syntax.')
  }
  return text
}

function acceleratorIdentity(value: string): string {
  const aliases: Readonly<Record<string, string>> = {
    cmd: 'command',
    ctrl: 'control',
    cmdorctrl: 'commandorcontrol',
    option: 'alt',
    super: 'meta',
    esc: 'escape',
    return: 'enter',
  }
  const parts = value
    .toLowerCase()
    .split('+')
    .map((part) => aliases[part] ?? part)
  const key = parts.pop()!
  return `${parts.sort().join('+')}+${key}`
}

function isProxyEndpoint(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      ['http:', 'https:', 'socks5:'].includes(url.protocol) &&
      url.hostname !== '' &&
      !/[;,]/.test(url.hostname) &&
      url.username === '' &&
      url.password === '' &&
      (url.pathname === '' || url.pathname === '/') &&
      url.search === '' &&
      url.hash === ''
    )
  } catch {
    return false
  }
}

/** Validate a complete saved/default value; manual proxy execution additionally requires an actual endpoint. */
export function parsePreferences(input: unknown): Preferences {
  const shortcuts = objectSchema(v.entriesFromList(shortcutKeys, objectSchema(shortcutFields)))
  const value = parseContract(
    objectSchema({
      general: objectSchema(generalFields),
      appearance: objectSchema(appearanceFields),
      navigation: objectSchema(navigationFields),
      library: objectSchema(libraryFields),
      usage: objectSchema({
        foregroundGracePeriodMs: nonnegativeNumberSchema,
        game: objectSchema(gameFields),
        anime: objectSchema(animeFields),
        comic: objectSchema(readingFields),
        novel: objectSchema(readingFields),
      }),
      playback: objectSchema(playbackFields),
      shortcuts,
      network: objectSchema(networkFields),
      updates: objectSchema(updateFields),
    }),
    input,
    'preferences',
  )
  if (value.network.mode === 'manual' && value.network.endpoint === null) {
    return invalidInput('Manual proxy mode requires an endpoint.')
  }
  if (value.network.credentials !== null && value.network.endpoint?.startsWith('socks5:')) {
    return invalidInput('SOCKS5 proxy authentication is not supported.')
  }
  return value
}

/** Parse only named fields and related baselines; resource references and arrays remain complete values. */
export function parsePreferenceUpdate(input: unknown): PreferenceUpdate {
  const readingPatch = objectSchema({
    flow: v.exactOptional(readingFields.flow),
    colors: v.exactOptional(readingFields.colors),
    pages: v.exactOptional(objectSchema(exactPartialEntries(readingPageFields))),
    text: v.exactOptional(objectSchema(exactPartialEntries(readingTextFields))),
  })
  const fields = {
    general: objectSchema(exactPartialEntries(generalFields)),
    appearance: objectSchema(exactPartialEntries(appearanceFields)),
    navigation: objectSchema(exactPartialEntries(navigationFields)),
    library: objectSchema(exactPartialEntries(libraryFields)),
    usage: objectSchema({
      foregroundGracePeriodMs: v.exactOptional(nonnegativeNumberSchema),
      game: v.exactOptional(objectSchema(exactPartialEntries(gameFields))),
      anime: v.exactOptional(objectSchema(exactPartialEntries(animeFields))),
      comic: v.exactOptional(readingPatch),
      novel: v.exactOptional(readingPatch),
    }),
    playback: objectSchema(exactPartialEntries(playbackFields)),
    shortcuts: objectSchema(
      v.entriesFromList(
        shortcutKeys,
        v.exactOptional(objectSchema(exactPartialEntries(shortcutFields))),
      ),
    ),
    updates: objectSchema(exactPartialEntries(updateFields)),
  }
  const changes = objectSchema(
    exactPartialEntries({
      ...fields,
      network: objectSchema(
        exactPartialEntries({
          ...networkFields,
          credentials: v.nullable(objectSchema({ username: v.string(), password: v.string() })),
        }),
      ),
    }),
  )
  const expected = objectSchema(
    exactPartialEntries({ ...fields, network: objectSchema(exactPartialEntries(networkFields)) }),
  )
  const value = parseContract(
    objectSchema({ changes, expected: v.exactOptional(expected) }),
    input,
    'preference update',
  )
  const grouped = new Set([
    '',
    'general',
    'appearance',
    'navigation',
    'library',
    'usage',
    'usage.game',
    'usage.anime',
    'usage.comic',
    'usage.novel',
    'usage.comic.pages',
    'usage.comic.text',
    'usage.novel.pages',
    'usage.novel.text',
    'playback',
    'shortcuts',
    'network',
    'updates',
    ...shortcutKeys.map((key) => `shortcuts.${key}`),
  ])
  validateExpectedGroups(value.changes, value.expected, '', grouped)
  if (
    value.changes.network?.credentials !== undefined &&
    !Object.hasOwn(value.expected?.network ?? {}, 'credentials')
  ) {
    return invalidInput('Proxy credential changes require the original credential state.')
  }
  return value
}

function validateExpectedGroups(
  changes: object,
  expected: object | undefined,
  path: string,
  groups: ReadonlySet<string>,
): void {
  if (!hasRelatedExpected(changes, expected)) {
    invalidInput('Unrelated preference baseline.')
  }
  if (!expected) {
    return
  }
  const changed: Record<string, unknown> = Object.fromEntries(Object.entries(changes))
  const baselines: [string, unknown][] = Object.entries(expected)
  for (const [key, baseline] of baselines) {
    const nested = path ? `${path}.${key}` : key
    const value = changed[key]
    if (
      groups.has(nested) &&
      baseline !== null &&
      typeof baseline === 'object' &&
      value !== null &&
      typeof value === 'object'
    ) {
      validateExpectedGroups(value, baseline, nested, groups)
    }
  }
}
