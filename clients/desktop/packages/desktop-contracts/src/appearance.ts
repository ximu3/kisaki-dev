import type { NonEmptyArray, CallOptions, Disposable, Listener } from './operations'
import type { ReadResourceRef } from './resources'
import * as v from 'valibot'
import {
  fromParser,
  id,
  parseExternalValue,
  integer,
  parseValue,
  parseRecord,
  nonemptyText,
  optionalFields,
  validateExpectedKeys,
  text,
} from './validation'
import {
  parseId,
  normalizeLocalizedText,
  type LocalizedText,
} from '@kisaki3/extension-distribution/metadata'
import { parsePackagePath } from '@kisaki3/extension-distribution/manifest'
import { parseFontRef, type FontRef, type FontFileMetadata } from './fonts'
import {
  tokens,
  type VisualTokenName,
  type FontTokenName,
  type ColorScheme,
  type TokenValues,
  type TokenName,
} from '@kisaki3/desktop-appearance/tokens'
import { DesktopError, type ErrorSummary } from './errors'
import { parseTokenValue, parseTokenValues } from '@kisaki3/desktop-appearance/values'

/** A theme's stable identity and origin, retained even while its definition is unavailable. */
export type ThemeRef =
  | { readonly type: 'builtin'; readonly id: 'default' }
  | { readonly type: 'user'; readonly id: string }
  | { readonly type: 'extension'; readonly extensionId: string; readonly id: string }

/** A private font path relative to the owning extension's package or data root. */
export interface ExtensionFontFile {
  readonly scope: 'package' | 'data'
  readonly path: string
}

export type ThemeFont =
  | { readonly type: 'default' }
  | FontRef
  | { readonly type: 'extension'; readonly files: NonEmptyArray<ExtensionFontFile> }

export type UserThemeFont = Exclude<ThemeFont, { readonly type: 'extension' }>

/** A complete visual branch with stable desktop font selections in the shared font slots. */
export type AppearanceTokens = Readonly<
  Record<VisualTokenName, string> & Record<FontTokenName, ThemeFont>
>

/** A complete user-theme branch whose font slots use default, system or user fonts. */
export type UserAppearanceTokens = Readonly<
  Record<VisualTokenName, string> & Record<FontTokenName, UserThemeFont>
>

export const appearanceModes = ['system', 'light', 'dark'] as const

export interface AppearancePreferences {
  readonly mode: (typeof appearanceModes)[number]
  /** Integer UI scale in percent, from 75 through 200; text and content zoom remain separate. */
  readonly interfaceScale: number
  readonly theme: ThemeRef
}

/** A theme's origin-correlated identity, name and complete light and dark branches. */
export type Theme<T extends ThemeRef['type'] = ThemeRef['type']> = {
  [K in T]: {
    readonly ref: Extract<ThemeRef, { readonly type: K }>
    readonly name: K extends 'user' ? string : LocalizedText
    readonly light: K extends 'extension' ? AppearanceTokens : UserAppearanceTokens
    readonly dark: K extends 'extension' ? AppearanceTokens : UserAppearanceTokens
  }
}[T]

export type ThemeSummary<T extends ThemeRef['type'] = ThemeRef['type']> = {
  [K in T]: Pick<Theme<K>, 'ref' | 'name'>
}[T]

/** A complete theme contribution whose private font paths belong to the registering extension. */
export interface ExtensionThemeDefinition {
  readonly name: LocalizedText
  readonly light: AppearanceTokens
  readonly dark: AppearanceTokens
}

export interface UserThemeCreate {
  readonly name: string
  readonly light: UserAppearanceTokens
  readonly dark: UserAppearanceTokens
}

/** Branch tokens compare individually. A font slot replaces and compares its complete selection. */
export interface UserThemeUpdate {
  readonly changes: {
    readonly name?: string
    readonly light?: Partial<UserAppearanceTokens>
    readonly dark?: Partial<UserAppearanceTokens>
  }
  readonly expected?: {
    readonly name?: string
    readonly light?: Partial<UserAppearanceTokens>
    readonly dark?: Partial<UserAppearanceTokens>
  }
}

/** System font families do not have file mappings in their slots. */
export interface ThemeFontResourceFile {
  readonly resource: ReadResourceRef
  readonly metadata: FontFileMetadata
}

/** Acquired font files indexed by color scheme and font slot. */
export type ThemeFontResources = Readonly<
  Record<ColorScheme, Readonly<Partial<Record<FontTokenName, readonly ThemeFontResourceFile[]>>>>
>

/** A fixed theme snapshot with font-resource holds owned by this read. */
export interface ThemeRead<T extends ThemeRef['type'] = ThemeRef['type']> {
  readonly theme: Theme<T>
  readonly fontResources: ThemeFontResources

  /**
   * Repeated disposal is safe. The snapshot and other reads stay valid after its font resources are
   * released.
   */
  dispose(): Promise<void>
}

/** Removing the registration preserves already acquired reads. */
export interface ExtensionThemeRegistration {
  readonly ref: Extract<ThemeRef, { readonly type: 'extension' }>

  /**
   * Replaces the complete definition atomically. Failure preserves the previous definition and
   * registration.
   */
  update(input: ExtensionThemeDefinition, call?: CallOptions): Promise<void>

  /** Removes this registration while preserving acquired reads and any later registration. */
  dispose(): Promise<void>
}

export interface AppearancePreviewInput {
  readonly colorScheme: ColorScheme
  readonly tokens: AppearanceTokens
}

/** Takeover ends the previous handle. Late updates from that handle cannot affect the new owner. */
export interface AppearancePreview {
  /**
   * Publishes a preview only after validation and preparation. A failed update leaves the current
   * preview in place.
   */
  update(input: AppearancePreviewInput): Promise<void>

  /** Ends the preview idempotently and resolves the latest saved appearance. */
  dispose(): Promise<void>

  /** Delivers the end of this preview once, including to late subscribers. */
  onDispose(listener: () => void): Disposable
}

/** The document owns native FontFace instances and their release. */
export interface ViewFontFace {
  readonly family: string
  readonly url: string
  readonly descriptors: {
    readonly weight: string
    readonly style: string
    readonly stretch: string
    readonly unicodeRange?: string
    readonly variationSettings?: string
    readonly featureSettings?: string
  }
}

export interface ViewAppearance {
  readonly colorScheme: ColorScheme
  /** UI scale in percent. */
  readonly interfaceScale: number
  readonly cssVariables: TokenValues
  readonly fontFaces: readonly ViewFontFace[]
}

export type AppearanceIssue =
  | { readonly code: 'themeUnavailable'; readonly ref: ThemeRef; readonly error: ErrorSummary }
  | {
      readonly code: 'fontUnavailable'
      readonly slot: FontTokenName
      readonly font: ThemeFont
      readonly error: ErrorSummary
    }

/** A null theme identifies a live unsaved preview. */
export interface AppearanceState {
  readonly theme: ThemeRef | null
  readonly colorScheme: ColorScheme
  /** UI scale in percent. */
  readonly interfaceScale: number
  readonly tokens: AppearanceTokens
  readonly issues: readonly AppearanceIssue[]
}

/** The SDK binds registration identities to the actual extension before forwarding calls. */
export interface ThemesApi {
  /** Lists available theme identities and names without acquiring font resources. */
  list(call?: CallOptions): Promise<readonly ThemeSummary[]>

  /** Returns null for an absent theme. Reading a definition acquires no font resources. */
  get<R extends ThemeRef>(ref: R, call?: CallOptions): Promise<Theme<R['type']> | null>

  /**
   * Commits a user theme with two complete branches.
   *
   * The saved selection and any open preferences draft remain unchanged.
   */
  create(
    input: UserThemeCreate,
    call?: CallOptions,
  ): Promise<Extract<ThemeRef, { readonly type: 'user' }>>

  /**
   * Copies a theme into a user theme, preparing private font files before atomic commit.
   *
   * Copied private files become user fonts; existing user fonts retain their shared identities.
   */
  clone(
    ref: ThemeRef,
    input: { readonly name: string },
    call?: CallOptions,
  ): Promise<Extract<ThemeRef, { readonly type: 'user' }>>

  /**
   * Compares and commits the changed name, tokens and complete font selections.
   *
   * A failed comparison preserves the saved theme.
   */
  update(id: string, input: UserThemeUpdate, call?: CallOptions): Promise<void>

  /** Deletes a user theme while retaining its fonts and consumers' saved references. */
  delete(id: string, call?: CallOptions): Promise<void>

  /**
   * Acquires a fixed definition and all required font resources.
   *
   * A failed acquisition releases partial holds and rejects the read. The caller disposes the
   * returned read.
   */
  open<R extends ThemeRef>(ref: R, call?: CallOptions): Promise<ThemeRead<R['type']>>

  /** Duplicate local identities fail. The returned handle owns removal. */
  register(
    ref: Extract<ThemeRef, { readonly type: 'extension' }>,
    input: ExtensionThemeDefinition,
    call?: CallOptions,
  ): Promise<ExtensionThemeRegistration>

  /** Callers subscribe before reading; invalidation leaves editing drafts under their owners. */
  onInvalidated(listener: () => void): Disposable
}

/** Preferences owns the saved theme, mode and scale; preview leaves those values unchanged. */
export interface AppearanceApi {
  readonly themes: ThemesApi

  /** Reads effective appearance and availability issues without changing the saved selection. */
  getState(call?: CallOptions): Promise<AppearanceState>

  /** Delivers the effective appearance immediately and on subsequent changes. */
  observe(listener: Listener<AppearanceState>, call?: CallOptions): Promise<Disposable>

  /**
   * Takes over the application preview for the actual view.
   *
   * Resolves after validation, resource preparation and publication. Document rendering may finish
   * later.
   */
  preview(input: AppearancePreviewInput, call?: CallOptions): Promise<AppearancePreview>
}

const themeRef = v.variant('type', [
  v.strictObject({ type: v.literal('builtin'), id: v.literal('default') }),
  v.strictObject({ type: v.literal('user'), id }),
  v.strictObject({
    type: v.literal('extension'),
    extensionId: fromParser((value) =>
      parseExternalValue(parseId, value, 'Invalid extension identity'),
    ),
    id,
  }),
])

const colorScheme = v.picklist(['light', 'dark'])

/** Inclusive percent range shared by the appearance contract and its native editor. */
export const interfaceScaleRange = { min: 75, max: 200 } as const

const scale = v.pipe(
  integer,
  v.minValue(interfaceScaleRange.min),
  v.maxValue(interfaceScaleRange.max),
)

const extensionFile = v.strictObject({
  scope: v.picklist(['package', 'data']),
  path: fromParser((value) =>
    parseExternalValue(parsePackagePath, value, 'Invalid extension resource path'),
  ),
})

/** Parses a stable theme identity without resolving its availability. */
export function parseThemeRef(input: unknown): ThemeRef {
  return parseValue(themeRef, input, 'Invalid theme reference')
}

/** The adopting boundary enforces ownership of extension-private resources. */
export function parseThemeFont(input: unknown): ThemeFont {
  const { type } = parseValue(
    v.looseObject({ type: v.picklist(['default', 'system', 'user', 'extension']) }),
    input,
  )
  if (type === 'default') {
    return parseValue(v.strictObject({ type: v.literal('default') }), input)
  }
  if (type === 'system' || type === 'user') {
    return parseFontRef(input)
  }

  return parseValue(
    v.strictObject({
      type: v.literal('extension'),
      files: v.tupleWithRest([extensionFile], extensionFile),
    }),
    input,
    'Invalid theme font files',
  )
}

function parseTokens(
  input: unknown,
  partial: boolean,
  user: boolean,
): AppearanceTokens | Partial<AppearanceTokens> {
  const source = parseRecord(input)
  const keys = Object.keys(source)
  if (
    (!partial && keys.length !== Object.keys(tokens).length) ||
    keys.some((key) => !Object.hasOwn(tokens, key))
  ) {
    throw new DesktopError('InvalidInput', 'Appearance tokens must use the exact shared vocabulary')
  }

  const entries = keys.map((key) => {
    const name = key as TokenName
    if (name === '--font-sans' || name === '--font-mono') {
      const font = parseThemeFont(source[name])
      if (user && font.type === 'extension') {
        throw new DesktopError(
          'InvalidInput',
          'A user theme cannot retain extension-private font paths',
        )
      }

      return [name, font] as const
    }

    return [
      name,
      parseExternalValue(
        (value) => parseTokenValue(name, value),
        source[name],
        'Invalid appearance token value',
      ),
    ] as const
  })
  return Object.fromEntries(entries) as AppearanceTokens | Partial<AppearanceTokens>
}

/** Parses a complete desktop branch with shared visual rules and no default filling. */
export function parseAppearanceTokens(input: unknown): AppearanceTokens {
  return parseTokens(input, false, false) as AppearanceTokens
}

/** Parses saved selection and scale while preserving unavailable stable references. */
export function parseAppearancePreferences(input: unknown): AppearancePreferences {
  return parseValue(
    v.strictObject({
      mode: v.picklist(appearanceModes),
      interfaceScale: scale,
      theme: themeRef,
    }),
    input,
    'Invalid appearance preferences',
  )
}

/** Parses a new user theme with two complete branches and rejects extension-private font paths. */
export function parseUserThemeCreate(input: unknown): UserThemeCreate {
  const branch = fromParser((value) => parseTokens(value, false, true) as UserAppearanceTokens)
  return parseValue(
    v.strictObject({ name: nonemptyText, light: branch, dark: branch }),
    input,
    'Invalid user theme creation',
  )
}

/** Parses changed user-theme fields and restricts expected values to the same comparison units. */
export function parseUserThemeUpdate(input: unknown): UserThemeUpdate {
  const branch = fromParser(
    (value) => parseTokens(value, true, true) as Partial<UserAppearanceTokens>,
  )
  const fields = v.strictObject(optionalFields({ name: nonemptyText, light: branch, dark: branch }))
  const value = parseValue(
    v.strictObject({ changes: fields, expected: v.exactOptional(fields) }),
    input,
  )
  validateExpectedKeys(value.changes, value.expected)
  for (const name of ['light', 'dark'] as const) {
    validateExpectedKeys(value.changes[name] ?? {}, value.expected?.[name])
  }

  return value
}

/** Parses complete theme branches and normalizes the name with the manifest's default locale. */
export function parseExtensionThemeDefinition(
  input: unknown,
  defaultLocale: string,
): ExtensionThemeDefinition {
  return parseValue(
    v.strictObject({
      name: fromParser((value) =>
        parseExternalValue(
          (input) => normalizeLocalizedText(input, defaultLocale),
          value,
          'Invalid theme name',
        ),
      ),
      light: fromParser(parseAppearanceTokens),
      dark: fromParser(parseAppearanceTokens),
    }),
    input,
    'Invalid theme definition',
  )
}

/** Parses a complete preview branch and color scheme without requiring a saved identity. */
export function parseAppearancePreviewInput(input: unknown): AppearancePreviewInput {
  return parseValue(
    v.strictObject({
      colorScheme,
      tokens: fromParser(parseAppearanceTokens),
    }),
    input,
    'Invalid appearance preview',
  )
}

/** Resource binding and actual font loading remain host duties. */
export function parseViewAppearance(input: unknown): ViewAppearance {
  return parseValue(
    v.strictObject({
      colorScheme,
      interfaceScale: scale,
      cssVariables: fromParser((value) =>
        parseExternalValue(parseTokenValues, value, 'Invalid view appearance tokens'),
      ),
      fontFaces: v.array(
        v.strictObject({
          family: nonemptyText,
          url: nonemptyText,
          descriptors: v.strictObject({
            weight: nonemptyText,
            style: nonemptyText,
            stretch: nonemptyText,
            unicodeRange: v.exactOptional(text),
            variationSettings: v.exactOptional(text),
            featureSettings: v.exactOptional(text),
          }),
        }),
      ),
    }),
    input,
    'Invalid view appearance',
  )
}

export type { ColorScheme } from '@kisaki3/desktop-appearance/tokens'
