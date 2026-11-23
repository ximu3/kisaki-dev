import { catalogKey } from '../../../shared/catalog-ref'
import { createDocumentFonts } from './document-fonts'
import { nativeTheme } from 'electron'
import { createPreviews, type PrivateFontRead } from './preview'
import { defaults } from '@kisaki3/desktop-appearance/defaults'
import { resolveLocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { ColorScheme, FontTokenName } from '@kisaki3/desktop-appearance/tokens'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseExtensionThemeDefinition,
  type Theme,
  type ThemeRef,
  type AppearancePreferences,
  type ThemeFont,
  type ThemeFontResourceFile,
  type ThemeRead,
  type AppearanceState,
  type ViewAppearance,
  type ViewFontFace,
  type UserThemeCreate,
  type UserThemeUpdate,
  parseUserThemeCreate,
  type ExtensionThemeDefinition,
} from '@kisaki3/desktop-contracts/appearance'
import type { ViewResourcesApi, ReadResourceRef } from '@kisaki3/desktop-contracts/resources'
import type { createFonts } from '../fonts'
import type { themeStorage } from './storage'
import type { DatabaseCall } from '../../infrastructure/database/executor'
import { createSignal } from '../../infrastructure/events'
import { releaseAll } from '../../infrastructure/release'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'

/** Built-in theme uses stable default font selections in both complete visual branches. */
const builtin: Theme<'builtin'> = {
  ref: { type: 'builtin', id: 'default' },
  name: 'Kisaki',
  light: {
    ...defaults.light,
    '--font-sans': { type: 'default' },
    '--font-mono': { type: 'default' },
  },
  dark: {
    ...defaults.dark,
    '--font-sans': { type: 'default' },
    '--font-mono': { type: 'default' },
  },
}

/** Both slots are resolved from the same acquired branch. */
const slots = ['--font-sans', '--font-mono'] as const

/** Creates a theme directory, effective selection and preview owned by this app instance. */
export function createAppearance(
  fonts: ReturnType<typeof createFonts>,
  call: DatabaseCall<ReturnType<typeof themeStorage>>,
  digest: (ref: ReadResourceRef) => string,
) {
  const appearanceChanged = createSignal<void>()
  const catalogInvalidated = createSignal<void>()
  const extensions = new Map<
    string,
    { theme: Theme<'extension'>; read: PrivateFontRead; locale: string }
  >()
  let preferences: AppearancePreferences = {
    mode: 'system',
    theme: builtin.ref,
    interfaceScale: 100,
  }
  /** Fetches a definition without opening either branch's resources. */
  async function get(ref: ThemeRef, options?: CallOptions): Promise<Theme | null> {
    options?.signal?.throwIfAborted()
    if (ref.type === 'builtin') {
      return builtin
    }
    if (ref.type === 'user') {
      return call('getTheme', ref.id)
    }
    return extensions.get(catalogKey(ref))?.theme ?? null
  }
  /** Resolves one stable file selection into a fixed read, including its verified metadata. */
  async function acquire(font: ThemeFont, read?: PrivateFontRead, options?: CallOptions) {
    options?.signal?.throwIfAborted()
    if (font.type === 'extension') {
      if (!read) {
        throw new DesktopError('InvalidReference', 'The extension font is unavailable')
      }
      return read(font)
    }
    if (font.type !== 'user') {
      return null
    }
    const opened = await fonts.open(font.id, options)
    return {
      files: opened.font.files.map((file) => ({
        metadata: file.metadata,
        resource: opened.resources[file.attachmentId]!,
      })),
      dispose: () => opened.dispose(),
    }
  }
  const previews = createPreviews(slots, acquire, () => appearanceChanged.emit())

  const documents = new WeakMap<ViewResourcesApi, ReturnType<typeof createDocumentFonts>>()

  /** Resolves the selected theme independently from the system's current light or dark branch. */
  async function getState(options?: CallOptions): Promise<AppearanceState> {
    options?.signal?.throwIfAborted()
    const prefs = preferences
    const preview = previews.current
    if (preview) {
      return { theme: null, ...preview.input, interfaceScale: prefs.interfaceScale, issues: [] }
    }
    const systemScheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    const scheme = prefs.mode === 'system' ? systemScheme : prefs.mode
    let unavailable = { code: 'NotFound', message: 'The selected theme is unavailable' }
    let theme: Theme | null
    try {
      theme = await get(prefs.theme)
    } catch (cause) {
      if (!(cause instanceof DesktopError)) {
        throw cause
      }
      unavailable = { code: cause.code, message: cause.message }
      theme = null
    }
    return {
      theme: theme?.ref ?? builtin.ref,
      colorScheme: scheme,
      interfaceScale: prefs.interfaceScale,
      tokens: (theme ?? builtin)[scheme],
      issues: theme
        ? []
        : [
            {
              code: 'themeUnavailable',
              ref: prefs.theme,
              error: unavailable,
            },
          ],
    }
  }

  const systemColorChanged = () => {
    if (preferences.mode === 'system') {
      appearanceChanged.emit()
    }
  }
  nativeTheme.on('updated', systemColorChanged)
  const fontChanges = fonts.onInvalidated(() => appearanceChanged.emit())
  const invalidate = () => {
    catalogInvalidated.emit()
    appearanceChanged.emit()
  }

  const themes = {
    get,

    /** Resolves catalog text using this theme owner's fallback locale. */
    displayName(theme: Pick<Theme, 'ref' | 'name'>, locale: string) {
      return resolveLocalizedText(
        theme.name,
        locale,
        extensions.get(catalogKey(theme.ref))?.locale ?? 'en',
      )
    },

    /** Lists the complete catalog without acquiring its font files. */
    async list(options?: CallOptions) {
      options?.signal?.throwIfAborted()
      return [
        { ref: builtin.ref, name: builtin.name },
        ...(await call('listThemes')),
        ...[...extensions.values()].map(({ theme }) => ({ ref: theme.ref, name: theme.name })),
      ]
    },

    async create(input: UserThemeCreate, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      const ref = await call('createTheme', input)
      invalidate()
      return ref
    },

    /** Copies private font sets once per source selection and commits them with the new theme. */
    async clone(ref: ThemeRef, input: { name: string }, options?: CallOptions) {
      const theme = await get(ref, options)
      if (!theme) {
        throw new DesktopError('NotFound', 'The selected theme is unavailable')
      }
      const source = extensions.get(catalogKey(ref))
      const copies = new Map<string, Awaited<ReturnType<typeof fonts.prepareCopy>>>()
      const branches = { light: { ...theme.light }, dark: { ...theme.dark } }
      try {
        for (const branch of ['light', 'dark'] as const) {
          for (const slot of slots) {
            const selection = branches[branch][slot]
            if (selection.type !== 'extension') {
              continue
            }
            if (!source) {
              throw new DesktopError('InstanceExpired', 'The theme provider is unavailable')
            }
            const key = JSON.stringify(selection)
            let copy = copies.get(key)
            if (!copy) {
              const read = await source.read(selection)
              try {
                copy = await fonts.prepareCopy(
                  read.files.map((file) => ({ type: 'resource', resource: file.resource })),
                  options,
                )
                copies.set(key, copy)
              } finally {
                await read.dispose()
              }
            }
            branches[branch][slot] = { type: 'user', id: copy.value.id }
          }
        }
        options?.signal?.throwIfAborted()
        const copied = await call(
          'createTheme',
          parseUserThemeCreate({ name: input.name, ...branches }),
          [...copies.values()].map((copy) => copy.value),
        )
        if (copies.size) {
          fonts.adopted()
        }
        invalidate()
        return copied
      } finally {
        await releaseAll([...copies.values()].map((copy) => () => copy.dispose()))
      }
    },

    async update(id: string, input: UserThemeUpdate, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      await call('updateTheme', id, input)
      invalidate()
    },

    /** Removes the definition while preserving references and independently held reads. */
    async delete(id: string, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      await call('deleteTheme', id)
      invalidate()
    },

    /** Registers an extension's own definition and file reader; old handles cannot affect a successor. */
    register(
      extensionId: string,
      id: string,
      definition: ExtensionThemeDefinition,
      locale: string,
      read: PrivateFontRead,
      options?: CallOptions,
    ) {
      options?.signal?.throwIfAborted()
      const ref = { type: 'extension' as const, extensionId, id }
      const key = catalogKey(ref)
      if (extensions.has(key)) {
        throw new DesktopError('Conflict', 'This theme is already registered')
      }
      const registration = {
        locale,
        theme: { ref, ...parseExtensionThemeDefinition(definition, locale) },
        read,
      }
      extensions.set(key, registration)
      invalidate()
      return {
        ref,
        update(input: ExtensionThemeDefinition, options?: CallOptions) {
          options?.signal?.throwIfAborted()
          if (extensions.get(key) !== registration) {
            throw new DesktopError('InstanceExpired', 'The theme registration has ended')
          }
          registration.theme = { ref, ...parseExtensionThemeDefinition(input, locale) }
          invalidate()
        },
        /** Removes only this registration, leaving a replacement owner intact. */
        dispose() {
          if (extensions.get(key) === registration) {
            extensions.delete(key)
            invalidate()
          }
        },
      }
    },

    /** Opens both complete branches as a fixed snapshot and releases all partial reads on failure. */
    async open(ref: ThemeRef, options?: CallOptions): Promise<ThemeRead> {
      const theme = await get(ref, options)
      if (!theme) {
        throw new DesktopError('NotFound', 'The theme is unavailable')
      }
      const reads = new Map<string, Awaited<ReturnType<typeof acquire>>>()
      const fontResources: Record<
        ColorScheme,
        Partial<Record<FontTokenName, readonly ThemeFontResourceFile[]>>
      > = { light: {}, dark: {} }
      const dispose = async () => {
        await releaseAll([...reads.values()].map((read) => () => read?.dispose()))
      }
      try {
        for (const scheme of ['light', 'dark'] as const) {
          for (const slot of slots) {
            options?.signal?.throwIfAborted()
            const font = theme[scheme][slot]
            const key = JSON.stringify(font)
            if (!reads.has(key)) {
              reads.set(key, await acquire(font, extensions.get(catalogKey(ref))?.read, options))
            }
            const read = reads.get(key)
            if (read) {
              fontResources[scheme][slot] = read.files
            }
          }
        }
        options?.signal?.throwIfAborted()
        return { theme, fontResources, dispose }
      } catch (error) {
        await dispose()
        throw error
      }
    },

    onInvalidated: catalogInvalidated.on,
  }

  return {
    themes,
    getState,

    /** Delivers a first effective snapshot and rereads after changes for the lifetime of this observer. */
    async observe(listener: (state: AppearanceState) => void, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      let active = true
      let queued = Promise.resolve()
      const deliver = () => {
        const snapshot = getState()
        // Later reads can settle before an earlier notification has been delivered.
        void snapshot.catch(() => {})
        const delivery = queued.then(async () => {
          const state = await snapshot
          if (active) {
            return listener(state)
          }
        })
        queued = delivery.catch(() => {})
        return delivery
      }
      const change = appearanceChanged.on(() => deliver().catch(console.error))
      try {
        await deliver()
        options?.signal?.throwIfAborted()
      } catch (error) {
        await change.dispose()
        throw error
      }
      return {
        dispose() {
          active = false
          return change.dispose()
        },
      }
    },

    /** Supplies the current palette and scale while individual document fonts are still pending. */
    async base(): Promise<ViewAppearance> {
      const state = await getState()
      const cssVariables = {
        ...state.tokens,
        '--font-sans': defaults[state.colorScheme]['--font-sans'],
        '--font-mono': defaults[state.colorScheme]['--font-mono'],
      }
      for (const slot of slots) {
        const font = state.tokens[slot]
        if (font.type === 'system') {
          cssVariables[slot] = JSON.stringify(font.family) + ', ' + cssVariables[slot]
        }
      }
      return {
        colorScheme: state.colorScheme,
        interfaceScale: state.interfaceScale,
        cssVariables,
        fontFaces: [],
      }
    },

    /** Adopts the saved theme, mode and scale without changing their stored values. */
    select(value: AppearancePreferences) {
      preferences = value
      appearanceChanged.emit()
    },

    endPreview: () => previews.close(),

    preview: (
      input: Parameters<typeof previews.open>[0],
      options?: CallOptions,
      read?: PrivateFontRead,
    ) => previews.open(input, read, options),

    /** Resolves the current branch into CSS and independent resource URLs for one actual document. */
    async forView(view: ViewResourcesApi, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      let bind = documents.get(view)
      if (!bind) {
        bind = createDocumentFonts(view, digest)
        documents.set(view, bind)
      }
      const preview = previews.current
      const state = await getState()
      const css = {
        ...defaults[state.colorScheme],
        ...state.tokens,
        '--font-sans': defaults[state.colorScheme]['--font-sans'],
        '--font-mono': defaults[state.colorScheme]['--font-mono'],
      }
      const faces: ViewFontFace[] = []
      const fontFamilies: Partial<Record<FontTokenName, string>> = {}
      const holds: Array<{ dispose(): Promise<void> }> = []
      const issues = [...state.issues]
      let systemFonts: ReturnType<typeof fonts.listSystem> | undefined
      const dispose = async () => {
        await releaseAll(holds.map((hold) => () => hold.dispose()))
      }
      try {
        for (const slot of slots) {
          const font = state.tokens[slot]
          if (font.type === 'default') {
            continue
          }
          try {
            if (font.type === 'system') {
              const installed = await (systemFonts ??= fonts.listSystem(options))
              if (!installed.some((family) => family.toLowerCase() === font.family.toLowerCase())) {
                throw new DesktopError('NotFound', 'The selected system font is unavailable')
              }
              css[slot] = JSON.stringify(font.family) + ', ' + css[slot]
            } else {
              const read = state.theme
                ? await acquire(font, extensions.get(catalogKey(state.theme))?.read, options)
                : null
              const files = read?.files ?? preview?.resources[slot]
              try {
                if (!files?.length) {
                  throw new DesktopError(
                    'FileUnavailable',
                    'The selected font has no available files',
                  )
                }
                const bound = await bind(files)
                holds.push(bound)
                fontFamilies[slot] = bound.family
                css[slot] = bound.family + ', ' + css[slot]
                faces.push(...bound.faces)
              } finally {
                await read?.dispose()
              }
            }
          } catch (cause) {
            options?.signal?.throwIfAborted()
            issues.push({
              code: 'fontUnavailable',
              slot,
              font,
              error:
                cause instanceof DesktopError
                  ? { code: cause.code, message: cause.message }
                  : { code: 'FileUnavailable', message: 'The selected font is unavailable' },
            })
          }
        }
        options?.signal?.throwIfAborted()
        const appearance: ViewAppearance = {
          colorScheme: state.colorScheme,
          interfaceScale: state.interfaceScale,
          cssVariables: css,
          fontFaces: faces,
        }
        return { appearance, fontFamilies, issues, dispose }
      } catch (error) {
        await dispose()
        throw error
      }
    },

    onChanged: appearanceChanged.on,

    async close(this: void) {
      await releaseAll([
        () => nativeTheme.off('updated', systemColorChanged),
        () => previews.close(),
        () => fontChanges.dispose(),
      ])
    },
  }
}
