/** @fileoverview Combines the shared visual vocabulary with desktop theme identity, font resources and preview lifetimes. */

import type { FontRef, FontFileMetadata } from './fonts'
import type { NonEmptyArray, CallOptions, Disposable, Listener } from './operations'
import type {
  VisualTokenName,
  FontTokenName,
  ColorScheme,
  TokenValues,
  TokenName,
} from '@kisaki3/desktop-appearance/tokens'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { ReadResourceRef } from './resources'
import type { ErrorSummary } from './errors'
import * as v from 'valibot'
import {
  id,
  parseExternalValue,
  integer,
  parseValue,
  readRecord,
  nonemptyText,
  optionalFields,
  validateExpectedKeys,
  text,
} from './validation'
import { parseId, normalizeLocalizedText } from '@kisaki3/extension-distribution/metadata'
import { parsePackagePath } from '@kisaki3/extension-distribution/manifest'
import { parseFontRef } from './fonts'
import { tokens } from '@kisaki3/desktop-appearance/tokens'
import { DesktopError } from './errors'
import { parseTokenValue, parseTokenValues } from '@kisaki3/desktop-appearance/values'

/** A selected definition keeps its origin and stable ID even while unavailable. */
export type ThemeRef =
  | { readonly type: 'builtin'; readonly id: 'default' }
  | { readonly type: 'user'; readonly id: string }
  | { readonly type: 'extension'; readonly extensionId: string; readonly id: string }

/** Private font files are relative to the theme's actual owning extension, never an arbitrary extension ID or URL. */
export interface ExtensionFontFile {
  readonly scope: 'package' | 'data'
  readonly path: string
}

export type ThemeFont =
  | { readonly type: 'default' }
  | FontRef
  | { readonly type: 'extension'; readonly files: NonEmptyArray<ExtensionFontFile> }

export type UserThemeFont = Exclude<ThemeFont, { readonly type: 'extension' }>

/** All 45 vocabulary keys are present; only font slots replace CSS strings with stable desktop selections. */
export type AppearanceTokens = Readonly<
  Record<VisualTokenName, string> & Record<FontTokenName, ThemeFont>
>

export type UserAppearanceTokens = Readonly<
  Record<VisualTokenName, string> & Record<FontTokenName, UserThemeFont>
>

export interface AppearancePreferences {
  readonly mode: 'system' | ColorScheme
  /** Integer UI scale in percent, from 75 through 200; text and content zoom remain separate. */
  readonly interfaceScale: number
  readonly theme: ThemeRef
}

export interface Theme {
  readonly ref: ThemeRef
  readonly name: LocalizedText
  readonly light: AppearanceTokens
  readonly dark: AppearanceTokens
}

export interface ThemeDefinition {
  readonly name: LocalizedText
  readonly light: AppearanceTokens
  readonly dark: AppearanceTokens
}

export interface UserThemeCreate {
  readonly name: string
  readonly light: UserAppearanceTokens
  readonly dark: UserAppearanceTokens
}

/** Branch tokens compare individually. A font slot always replaces and compares its complete selection. */
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

/** Fixed acquired bytes and parsed metadata; a system family has no file mapping in its slot. */
export interface ThemeFontResourceFile {
  readonly resource: ReadResourceRef
  readonly metadata: FontFileMetadata
}

export type ThemeFontResources = Readonly<
  Record<ColorScheme, Readonly<Partial<Record<FontTokenName, readonly ThemeFontResourceFile[]>>>>
>

export interface ThemeRead {
  readonly theme: Theme
  readonly fontResources: ThemeFontResources

  /**
   * Release this read's font-resource holds idempotently; its plain snapshot remains readable
   * and other reads stay valid.
   */
  dispose(): Promise<void>
}

/** Definition replacement is complete and atomic; registration removal does not revoke already held reads. */
export interface ThemeRegistration {
  readonly ref: Extract<ThemeRef, { readonly type: 'extension' }>

  /**
   * Validate and replace the complete definition atomically, preserving this registration's
   * identity and old value on failure.
   */
  update(input: ThemeDefinition, call?: CallOptions): Promise<void>

  /**
   * Remove only this registration; already acquired reads keep their holds, and a later
   * registration is unaffected.
   */
  dispose(): Promise<void>
}

export interface AppearancePreviewInput {
  readonly colorScheme: ColorScheme
  readonly tokens: AppearanceTokens
}

/** One actual view owns a preview; takeover ends the previous handle, and late updates cannot affect the new owner. */
export interface AppearancePreview {
  /**
   * Validate, prepare and publish the new branch; failure preserves the current preview, and
   * ended handles reject updates.
   */
  update(input: AppearancePreviewInput): Promise<void>

  /**
   * End this preview idempotently and resolve the latest saved appearance; do not restore the
   * editor's opening snapshot.
   */
  dispose(): Promise<void>

  /**
   * Notify once when this handle ends, including a subscription made after it has ended;
   * releasing only removes the listener.
   */
  onDispose(listener: () => void): Disposable
}

/** Document-specific, loadable font resources. Native FontFace instances and release duties stay with the document. */
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

/** Effective app appearance, with no view URLs. Null theme denotes a live unsaved preview rather than a saved identity. */
export interface AppearanceState {
  readonly theme: ThemeRef | null
  readonly colorScheme: ColorScheme
  /** UI scale in percent. */
  readonly interfaceScale: number
  readonly tokens: AppearanceTokens
  readonly issues: readonly AppearanceIssue[]
}

/** The complete desktop theme surface; the SDK binds register's complete ref to the real extension before forwarding. */
export interface ThemesApi {
  /** Read available theme identities and display names without acquiring their font resources. */
  list(call?: CallOptions): Promise<readonly Pick<Theme, 'ref' | 'name'>[]>

  /**
   * Read the complete definition for browsing or editing without acquiring a ThemeRead; absence
   * returns null.
   */
  get(ref: ThemeRef, call?: CallOptions): Promise<Theme | null>

  /**
   * Commit a user theme with two complete branches without selecting it or saving any
   * preferences draft.
   */
  create(
    input: UserThemeCreate,
    call?: CallOptions,
  ): Promise<Extract<ThemeRef, { readonly type: 'user' }>>

  /**
   * Prepare extension-private font files, then commit the copied theme and new user fonts
   * atomically; existing user fonts retain shared identities.
   */
  clone(
    ref: ThemeRef,
    input: { readonly name: string },
    call?: CallOptions,
  ): Promise<Extract<ThemeRef, { readonly type: 'user' }>>

  /**
   * Compare and commit only the changed name, tokens and complete font selections; a failed
   * comparison preserves the saved theme.
   */
  update(id: string, input: UserThemeUpdate, call?: CallOptions): Promise<void>

  /** Delete a user theme without deleting its fonts or rewriting consumers' saved references. */
  delete(id: string, call?: CallOptions): Promise<void>

  /**
   * Acquire a fixed definition and all required font resources; any failed acquisition releases
   * partial holds and rejects the read.
   */
  open(ref: ThemeRef, call?: CallOptions): Promise<ThemeRead>

  /**
   * Register a complete theme for the actual extension owner; duplicate local identities fail,
   * and the returned handle owns removal.
   */
  register(
    ref: Extract<ThemeRef, { readonly type: 'extension' }>,
    input: ThemeDefinition,
    call?: CallOptions,
  ): Promise<ThemeRegistration>

  /**
   * Subscribe before reading the theme directory; notifications request a new snapshot without
   * replacing an editing draft.
   */
  onInvalidated(listener: () => void): Disposable
}

/** Saving the selected theme/mode/scale belongs solely to preferences; preview never writes that selection. */
export interface AppearanceApi {
  readonly themes: ThemesApi

  /**
   * Read effective appearance and availability issues without creating a preview or changing the
   * saved selection.
   */
  getState(call?: CallOptions): Promise<AppearanceState>

  /**
   * Deliver current effective appearance and subsequent changes; releasing observation leaves
   * appearance state unchanged.
   */
  observe(listener: Listener<AppearanceState>, call?: CallOptions): Promise<Disposable>

  /**
   * Take over the one application preview for the actual view. Resolve after validation,
   * resource preparation and publication, before all documents necessarily render.
   */
  preview(input: AppearancePreviewInput, call?: CallOptions): Promise<AppearancePreview>
}

const themeRef = v.variant('type', [
  v.strictObject({ type: v.literal('builtin'), id: v.literal('default') }),
  v.strictObject({ type: v.literal('user'), id }),
  v.strictObject({
    type: v.literal('extension'),
    extensionId: v.pipe(
      v.unknown(),
      v.transform((value) => parseExternalValue(parseId, value, 'Invalid extension identity')),
    ),
    id,
  }),
])

const colorScheme = v.picklist(['light', 'dark'])

const scale = v.pipe(integer, v.minValue(75), v.maxValue(200))

const extensionFile = v.strictObject({
  scope: v.picklist(['package', 'data']),
  path: v.pipe(
    v.unknown(),
    v.transform((value) =>
      parseExternalValue(parsePackagePath, value, 'Invalid extension resource path'),
    ),
  ),
})

/** Check a stable theme reference without resolving availability or changing the user's selection. */
export function parseThemeRef(input: unknown): ThemeRef {
  return parseValue(themeRef, input, 'Invalid theme reference')
}

/** Validate resource selections; only an owning extension theme can adopt its private file branch. */
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
  const source = readRecord(input)
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

/** Validate a complete desktop branch using the actual appearance package's visual rules, with no default filling. */
export function parseAppearanceTokens(input: unknown): AppearanceTokens {
  return parseTokens(input, false, false) as AppearanceTokens
}

/** Validate complete saved selection and scale while preserving unavailable stable references. */
export function parseAppearancePreferences(input: unknown): AppearancePreferences {
  return parseValue(
    v.strictObject({
      mode: v.picklist(['system', 'light', 'dark']),
      interfaceScale: scale,
      theme: themeRef,
    }),
    input,
    'Invalid appearance preferences',
  )
}

/** New user themes own two complete branches and cannot retain an extension's private lifetime. */
export function parseUserThemeCreate(input: unknown): UserThemeCreate {
  const branch = v.pipe(
    v.unknown(),
    v.transform((value) => parseTokens(value, false, true) as UserAppearanceTokens),
  )
  return parseValue(
    v.strictObject({ name: nonemptyText, light: branch, dark: branch }),
    input,
    'Invalid user theme creation',
  )
}

/** Compare only changed tokens and complete font selections; independent changes in the other branch remain valid. */
export function parseUserThemeUpdate(input: unknown): UserThemeUpdate {
  const branch = v.pipe(
    v.unknown(),
    v.transform((value) => parseTokens(value, true, true) as Partial<UserAppearanceTokens>),
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

/** Normalize static names using the owning manifest's declared default locale, never the current UI language. */
export function parseThemeDefinition(input: unknown, defaultLocale: string): ThemeDefinition {
  return parseValue(
    v.strictObject({
      name: v.pipe(
        v.unknown(),
        v.transform((value) =>
          parseExternalValue(
            (input) => normalizeLocalizedText(input, defaultLocale),
            value,
            'Invalid theme name',
          ),
        ),
      ),
      light: v.pipe(v.unknown(), v.transform(parseAppearanceTokens)),
      dark: v.pipe(v.unknown(), v.transform(parseAppearanceTokens)),
    }),
    input,
    'Invalid theme definition',
  )
}

/** Validate a preview's selected branch without asking for a saved identity or touching preference values. */
export function parseAppearancePreviewInput(input: unknown): AppearancePreviewInput {
  return parseValue(
    v.strictObject({
      colorScheme,
      tokens: v.pipe(v.unknown(), v.transform(parseAppearanceTokens)),
    }),
    input,
    'Invalid appearance preview',
  )
}

/** Validate the final per-document projection; resource binding and actual font loading remain separate host duties. */
export function parseViewAppearance(input: unknown): ViewAppearance {
  return parseValue(
    v.strictObject({
      colorScheme,
      interfaceScale: scale,
      cssVariables: v.pipe(
        v.unknown(),
        v.transform((value) =>
          parseExternalValue(parseTokenValues, value, 'Invalid view appearance tokens'),
        ),
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
