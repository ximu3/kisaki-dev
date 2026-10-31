/** @fileoverview Defines complete desktop themes, font stacks, view delivery, and owned preview lifetimes. */

import {
  appearanceTokenNames,
  defaultDarkTokens,
  defaultLightTokens,
  parseVisualToken,
  type AppearanceTokenName,
  type VisualTokens,
} from '@kisaki3/appearance'
import {
  parseExtensionId,
  parseLocalId,
  parsePackagePath,
} from '@kisaki3/extension-distribution/identity'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import * as v from 'valibot'
import { invalidInput } from './errors'
import type { AsyncDisposable, CallOptions, Disposable, Registration } from './execution'
import { fontRefSchema, type FontFileMetadata, type FontRef } from './fonts'
import type { ReadResourceRef } from './resources'
import { objectSchema } from './schema'
import { nonemptyStringSchema, parseContract } from './validation'

/** The resolved scheme is separate from a saved system-following preference. */
export type ColorScheme = 'light' | 'dark'
/** Stable full theme identity; names, enabled state, and runtime generations do not replace it. */
export type ThemeRef =
  | { readonly type: 'builtin'; readonly id: 'default' }
  | { readonly type: 'user'; readonly id: string }
  | { readonly type: 'extension'; readonly extensionId: string; readonly id: string }
/** A stack member. Resource paths are relative to the actual owning extension's package or data scope. */
export type ThemeFontSource =
  | { readonly type: 'default' }
  | FontRef
  | { readonly type: 'resource'; readonly scope: 'package' | 'data'; readonly path: string }
/** A nonempty ordered fallback stack; desktop resources are resolved before generating CSS family names. */
export type ThemeFontStack = readonly [ThemeFontSource, ...ThemeFontSource[]]
/** Desktop themes compose the shared visual vocabulary with real font choices, not temporary URLs. */
export type AppearanceTokens = Omit<Readonly<VisualTokens>, '--font-sans' | '--font-mono'> & {
  readonly '--font-sans': ThemeFontStack
  readonly '--font-mono': ThemeFontStack
}
export interface Theme {
  readonly ref: ThemeRef
  readonly name: LocalizedText
  readonly light: AppearanceTokens
  readonly dark: AppearanceTokens
}
export interface AppearancePreferences {
  readonly mode: 'system' | ColorScheme
  readonly interfaceScale: number
  readonly theme: ThemeRef
}
export interface ThemeSummary {
  readonly ref: ThemeRef
  readonly name: LocalizedText
}
export interface ThemeCreate {
  readonly name: string
  readonly light: AppearanceTokens
  readonly dark: AppearanceTokens
}
export interface ThemeUpdate {
  readonly changes: {
    readonly name?: string
    readonly light?: Partial<AppearanceTokens>
    readonly dark?: Partial<AppearanceTokens>
  }
  readonly expected?: {
    readonly name?: string
    readonly light?: Partial<AppearanceTokens>
    readonly dark?: Partial<AppearanceTokens>
  }
}

/** Each source retains a fixed content snapshot; system families have no file resources. */
export interface ThemeFontResource {
  readonly source: ThemeFontSource
  readonly files: readonly {
    readonly resource: ReadResourceRef
    readonly metadata: FontFileMetadata
  }[]
}
export type ThemeFontResources = Readonly<
  Record<ColorScheme, Readonly<Record<'--font-sans' | '--font-mono', readonly ThemeFontResource[]>>>
>
export interface ThemeRead extends AsyncDisposable {
  readonly theme: Theme
  readonly fontResources: ThemeFontResources
}
/** Browser font resources are already bound to the actual document; no private file paths appear here. */
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
/** One complete adoptable document snapshot; latest preparation wins and each document loads its own fonts. */
export interface ViewAppearance {
  readonly colorScheme: ColorScheme
  readonly interfaceScale: number
  readonly cssVariables: Readonly<Record<AppearanceTokenName, string>>
  readonly fontFaces: readonly ViewFontFace[]
}
export interface AppearancePreviewInput {
  readonly colorScheme: ColorScheme
  readonly tokens: AppearanceTokens
}
/** One actual view owns the application-wide preview. Replaced/closed previews cannot update a newer one. */
export interface AppearancePreview extends AsyncDisposable {
  /** Prepare and publish the next complete draft; failure retains the previous effective preview. */
  update(input: AppearancePreviewInput): Promise<void>
  /** Deliver disposal once, including immediately to a listener added after disposal. */
  onDispose(listener: () => void): Disposable
}
export interface ThemeRegistration extends Registration<Extract<ThemeRef, { type: 'extension' }>> {
  /** Replace the complete definition without changing its identity; failure leaves the old definition. */
  update(input: {
    readonly name: LocalizedText
    readonly light: AppearanceTokens
    readonly dark: AppearanceTokens
  }): Promise<void>
}

/** Native theme operations do not save preferences or create a second selected-theme owner. */
export interface AppearanceApi {
  readonly themes: {
    /** Publish a full extension-owned theme definition; the actual endpoint supplies and verifies ownership. */
    register(
      theme: Theme & { readonly ref: Extract<ThemeRef, { type: 'extension' }> },
      call?: CallOptions,
    ): Promise<ThemeRegistration>
    /** Read the currently available catalog without acquiring font resources. */
    list(call?: CallOptions): Promise<readonly ThemeSummary[]>
    /** Read a complete definition or null. */
    get(ref: ThemeRef, call?: CallOptions): Promise<Theme | null>
    /** Save both schemes as a new independent user theme; selection stays explicit. */
    create(input: ThemeCreate, call?: CallOptions): Promise<Extract<ThemeRef, { type: 'user' }>>
    /** Clone the definition and import only extension-private fonts needed for an independent copy. */
    clone(
      ref: ThemeRef,
      input: { readonly name: string },
      call?: CallOptions,
    ): Promise<Extract<ThemeRef, { type: 'user' }>>
    /** Compare only changed name/tokens and atomically save the complete resulting theme. */
    update(id: string, input: ThemeUpdate, call?: CallOptions): Promise<void>
    /** Remove the user theme; selected references and independently owned fonts remain intact. */
    delete(id: string, call?: CallOptions): Promise<void>
    /** Acquire a complete two-scheme snapshot and all necessary resources, or fail without a partial read. */
    open(ref: ThemeRef, call?: CallOptions): Promise<ThemeRead>
    /** Establish catalog invalidation delivery before returning its independently releasable handle. */
    onInvalidated(listener: () => void): Promise<AsyncDisposable>
  }
  /** Prepare and publish a preview bound to the actual calling view, replacing any previous preview. */
  preview(input: AppearancePreviewInput, call?: CallOptions): Promise<AppearancePreview>
}

const extensionId = v.pipe(
  v.string(),
  v.check((value) => {
    try {
      parseExtensionId(value)
      return true
    } catch {
      return false
    }
  }),
)
const localId = v.pipe(
  v.string(),
  v.check((value) => {
    try {
      parseLocalId(value)
      return true
    } catch {
      return false
    }
  }),
)
export const themeRefSchema: v.GenericSchema<unknown, ThemeRef> = v.union([
  objectSchema({ type: v.literal('builtin'), id: v.literal('default') }),
  objectSchema({ type: v.literal('user'), id: nonemptyStringSchema }),
  objectSchema({ type: v.literal('extension'), extensionId, id: localId }),
])
const fontSource: v.GenericSchema<unknown, ThemeFontSource> = v.union([
  objectSchema({ type: v.literal('default') }),
  fontRefSchema,
  objectSchema({
    type: v.literal('resource'),
    scope: v.picklist(['package', 'data']),
    path: v.pipe(
      v.string(),
      v.check((value) => {
        try {
          parsePackagePath(value)
          return true
        } catch {
          return false
        }
      }),
    ),
  }),
])
const fontStack = v.pipe(v.tupleWithRest([fontSource], fontSource), v.readonly())

/** Parse a stable theme identity without resolving availability or activating an extension. */
export function parseThemeRef(input: unknown): ThemeRef {
  return parseContract(themeRefSchema, input, 'theme reference')
}
/** Validate all token families while leaving font resolution and genuine resource ownership to the host. */
export function parseAppearanceTokens(input: unknown): AppearanceTokens {
  const values = parseContract(
    objectSchema(Object.fromEntries(appearanceTokenNames.map((name) => [name, v.unknown()]))),
    input,
    'appearance tokens',
  )
  const parsed: Record<string, unknown> = {}
  for (const name of appearanceTokenNames) {
    if (name === '--font-sans' || name === '--font-mono') {
      parsed[name] = parseContract(fontStack, values[name], 'theme font stack')
    } else {
      try {
        parsed[name] = parseVisualToken(name, values[name])
      } catch {
        return invalidInput('Invalid appearance token value.')
      }
    }
  }
  return parsed as AppearanceTokens
}
/** Return fresh complete desktop defaults; the default font sources are resolved by the desktop host. */
export function getDefaultTheme(): Theme {
  return {
    ref: { type: 'builtin', id: 'default' },
    name: 'Kisaki',
    light: {
      ...defaultLightTokens,
      '--font-sans': [{ type: 'default' }],
      '--font-mono': [{ type: 'default' }],
    },
    dark: {
      ...defaultDarkTokens,
      '--font-sans': [{ type: 'default' }],
      '--font-mono': [{ type: 'default' }],
    },
  }
}

/** Validate a complete resolved document snapshot before font preparation and CSS adoption. */
export function parseViewAppearance(input: unknown): ViewAppearance {
  return parseContract(
    objectSchema({
      colorScheme: v.picklist(['light', 'dark']),
      interfaceScale: v.pipe(v.number(), v.integer(), v.minValue(75), v.maxValue(200)),
      cssVariables: objectSchema(v.entriesFromList(appearanceTokenNames, v.string())),
      fontFaces: v.pipe(
        v.array(
          objectSchema({
            family: nonemptyStringSchema,
            url: nonemptyStringSchema,
            descriptors: objectSchema({
              weight: v.string(),
              style: v.string(),
              stretch: v.string(),
              unicodeRange: v.exactOptional(v.string()),
              variationSettings: v.exactOptional(v.string()),
              featureSettings: v.exactOptional(v.string()),
            }),
          }),
        ),
        v.readonly(),
      ),
    }),
    input,
    'view appearance',
  )
}
