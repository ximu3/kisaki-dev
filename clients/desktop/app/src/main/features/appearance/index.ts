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
import { releaseAll, rethrowAfterRelease } from '../../infrastructure/release'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'

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

const slots = ['--font-sans', '--font-mono'] as const

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
  async function readTheme(
    ref: ThemeRef,
    options?: CallOptions,
  ): Promise<{
    theme: Theme | null
    read?: PrivateFontRead
  }> {
    options?.signal?.throwIfAborted()
    if (ref.type === 'builtin') {
      return { theme: builtin }
    }
    if (ref.type === 'user') {
      return { theme: await call('getTheme', ref.id) }
    }
    const source = extensions.get(catalogKey(ref))
    return source ? { theme: source.theme, read: source.read } : { theme: null }
  }
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

  async function resolveState(options?: CallOptions): Promise<{
    state: AppearanceState
    read?: PrivateFontRead | undefined
  }> {
    options?.signal?.throwIfAborted()
    const prefs = preferences
    const preview = previews.current
    if (preview) {
      return {
        state: { theme: null, ...preview.input, interfaceScale: prefs.interfaceScale, issues: [] },
      }
    }
    const systemScheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    const scheme = prefs.mode === 'system' ? systemScheme : prefs.mode
    let unavailable = { code: 'NotFound', message: 'The selected theme is unavailable' }
    let source: Awaited<ReturnType<typeof readTheme>>
    try {
      source = await readTheme(prefs.theme, options)
    } catch (cause) {
      if (!(cause instanceof DesktopError)) {
        throw cause
      }
      unavailable = { code: cause.code, message: cause.message }
      source = { theme: null }
    }
    const { theme, read } = source
    return {
      read,
      state: {
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
      },
    }
  }

  async function getState(options?: CallOptions) {
    return (await resolveState(options)).state
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
    async get(ref: ThemeRef, options?: CallOptions) {
      return (await readTheme(ref, options)).theme
    },

    displayName(theme: Pick<Theme, 'ref' | 'name'>, locale: string) {
      return resolveLocalizedText(
        theme.name,
        locale,
        extensions.get(catalogKey(theme.ref))?.locale ?? 'en',
      )
    },

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

    async clone(ref: ThemeRef, input: { name: string }, options?: CallOptions) {
      const { theme, read: readFont } = await readTheme(ref, options)
      if (!theme) {
        throw new DesktopError('NotFound', 'The selected theme is unavailable')
      }
      const copies = new Map<string, Awaited<ReturnType<typeof fonts.prepareCopy>>>()
      const branches = { light: { ...theme.light }, dark: { ...theme.dark } }
      try {
        for (const branch of ['light', 'dark'] as const) {
          for (const slot of slots) {
            const selection = branches[branch][slot]
            if (selection.type !== 'extension') {
              continue
            }
            if (!readFont) {
              throw new DesktopError('InstanceExpired', 'The theme provider is unavailable')
            }
            const key = JSON.stringify(selection)
            let copy = copies.get(key)
            if (!copy) {
              const read = await readFont(selection)
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

    async delete(id: string, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      await call('deleteTheme', id)
      invalidate()
    },

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
        dispose() {
          if (extensions.get(key) === registration) {
            extensions.delete(key)
            invalidate()
          }
        },
      }
    },

    async open(ref: ThemeRef, options?: CallOptions): Promise<ThemeRead> {
      const { theme, read: readFont } = await readTheme(ref, options)
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
              reads.set(key, await acquire(font, readFont, options))
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
        return rethrowAfterRelease(error, dispose)
      }
    },

    onInvalidated: catalogInvalidated.on,
  }

  return {
    themes,
    getState,

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

    async forView(view: ViewResourcesApi, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      let bind = documents.get(view)
      if (!bind) {
        bind = createDocumentFonts(view, digest)
        documents.set(view, bind)
      }
      const preview = previews.current
      const { state, read: readFont } = await resolveState(options)
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
              const read = state.theme ? await acquire(font, readFont, options) : null
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
        return rethrowAfterRelease(error, dispose)
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
