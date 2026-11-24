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

export type ThemeRef =
  | { readonly type: 'builtin'; readonly id: 'default' }
  | { readonly type: 'user'; readonly id: string }
  | { readonly type: 'extension'; readonly extensionId: string; readonly id: string }

export interface ExtensionFontFile {
  readonly scope: 'package' | 'data'
  readonly path: string
}

export type ThemeFont =
  | { readonly type: 'default' }
  | FontRef
  | { readonly type: 'extension'; readonly files: NonEmptyArray<ExtensionFontFile> }

export type UserThemeFont = Exclude<ThemeFont, { readonly type: 'extension' }>

export type AppearanceTokens = Readonly<
  Record<VisualTokenName, string> & Record<FontTokenName, ThemeFont>
>

export type UserAppearanceTokens = Readonly<
  Record<VisualTokenName, string> & Record<FontTokenName, UserThemeFont>
>

export const appearanceModes = ['system', 'light', 'dark'] as const

export interface AppearancePreferences {
  readonly mode: (typeof appearanceModes)[number]
  readonly interfaceScale: number
  readonly theme: ThemeRef
}

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

export interface ThemeFontResourceFile {
  readonly resource: ReadResourceRef
  readonly metadata: FontFileMetadata
}

export type ThemeFontResources = Readonly<
  Record<ColorScheme, Readonly<Partial<Record<FontTokenName, readonly ThemeFontResourceFile[]>>>>
>

export interface ThemeRead<T extends ThemeRef['type'] = ThemeRef['type']> {
  readonly theme: Theme<T>
  readonly fontResources: ThemeFontResources

  dispose(): Promise<void>
}

export interface ExtensionThemeRegistration {
  readonly ref: Extract<ThemeRef, { readonly type: 'extension' }>

  update(input: ExtensionThemeDefinition, call?: CallOptions): Promise<void>

  dispose(): Promise<void>
}

export interface AppearancePreviewInput {
  readonly colorScheme: ColorScheme
  readonly tokens: AppearanceTokens
}

export interface AppearancePreview {
  update(input: AppearancePreviewInput): Promise<void>

  dispose(): Promise<void>

  onDispose(listener: () => void): Disposable
}

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

export interface AppearanceState {
  readonly theme: ThemeRef | null
  readonly colorScheme: ColorScheme
  readonly interfaceScale: number
  readonly tokens: AppearanceTokens
  readonly issues: readonly AppearanceIssue[]
}

export interface ThemesApi {
  list(call?: CallOptions): Promise<readonly ThemeSummary[]>

  get<R extends ThemeRef>(ref: R, call?: CallOptions): Promise<Theme<R['type']> | null>

  create(
    input: UserThemeCreate,
    call?: CallOptions,
  ): Promise<Extract<ThemeRef, { readonly type: 'user' }>>

  clone(
    ref: ThemeRef,
    input: { readonly name: string },
    call?: CallOptions,
  ): Promise<Extract<ThemeRef, { readonly type: 'user' }>>

  update(id: string, input: UserThemeUpdate, call?: CallOptions): Promise<void>

  delete(id: string, call?: CallOptions): Promise<void>

  open<R extends ThemeRef>(ref: R, call?: CallOptions): Promise<ThemeRead<R['type']>>

  register(
    ref: Extract<ThemeRef, { readonly type: 'extension' }>,
    input: ExtensionThemeDefinition,
    call?: CallOptions,
  ): Promise<ExtensionThemeRegistration>

  onInvalidated(listener: () => void): Disposable
}

export interface AppearanceApi {
  readonly themes: ThemesApi

  getState(call?: CallOptions): Promise<AppearanceState>

  observe(listener: Listener<AppearanceState>, call?: CallOptions): Promise<Disposable>

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

export function parseThemeRef(input: unknown): ThemeRef {
  return parseValue(themeRef, input, 'Invalid theme reference')
}

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

interface ParsedTokensByUse {
  theme: AppearanceTokens
  userTheme: UserAppearanceTokens
  userChanges: Partial<UserAppearanceTokens>
}

function parseTokens<K extends keyof ParsedTokensByUse>(
  input: unknown,
  kind: K,
): ParsedTokensByUse[K] {
  const source = parseRecord(input)
  const keys = Object.keys(source)
  if (
    (kind !== 'userChanges' && keys.length !== Object.keys(tokens).length) ||
    keys.some((key) => !Object.hasOwn(tokens, key))
  ) {
    throw new DesktopError('InvalidInput', 'Appearance tokens must use the exact shared vocabulary')
  }

  const entries = keys.map((key) => {
    const name = key as TokenName
    if (name === '--font-sans' || name === '--font-mono') {
      const font = parseThemeFont(source[name])
      if (kind !== 'theme' && font.type === 'extension') {
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
  return Object.fromEntries(entries) as ParsedTokensByUse[K]
}

export function parseAppearanceTokens(input: unknown): AppearanceTokens {
  return parseTokens(input, 'theme')
}

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

export function parseUserThemeCreate(input: unknown): UserThemeCreate {
  const branch = fromParser((value) => parseTokens(value, 'userTheme'))
  return parseValue(
    v.strictObject({ name: nonemptyText, light: branch, dark: branch }),
    input,
    'Invalid user theme creation',
  )
}

export function parseUserThemeUpdate(input: unknown): UserThemeUpdate {
  const branch = fromParser((value) => parseTokens(value, 'userChanges'))
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
