/** @fileoverview Resolves theme selection, one application-wide preview and per-document font resources. */

import { randomUUID } from 'node:crypto'
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
import type { ViewResourcesApi, ViewResourceBinding } from '@kisaki3/desktop-contracts/resources'
import type { createFonts } from '../fonts'
import type { themeStorage } from './storage'
import type { DatabaseCall } from '../../infrastructure/database/executor'
import { createSignal } from '../../infrastructure/events'
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
) {
  /** Publishes changes that require a new effective appearance. */
  const changed = createSignal<void>()
  /** Invalidates the theme catalog independently of current selection. */
  const directory = createSignal<void>()
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
  async function get(ref: ThemeRef): Promise<Theme | null> {
    if (ref.type === 'builtin') {
      return builtin
    }
    if (ref.type === 'user') {
      return call('getTheme', ref.id)
    }
    return extensions.get(JSON.stringify(ref))?.theme ?? null
  }
  /** Resolves one stable file selection into a fixed read, including its verified metadata. */
  async function acquire(font: ThemeFont, read?: PrivateFontRead) {
    if (font.type === 'extension') {
      if (!read) {
        throw new DesktopError('InvalidReference', 'The extension font is unavailable')
      }
      return read(font)
    }
    if (font.type !== 'user') {
      return null
    }
    const opened = await fonts.open(font.id)
    return {
      files: opened.font.files.map((file) => ({
        metadata: file.metadata,
        resource: opened.resources[file.attachmentId]!,
      })),
      /** Releases this independently acquired font set. */
      dispose: () => opened.dispose(),
    }
  }
  const previews = createPreviews(slots, acquire, () => changed.emit())

  /** Resolves the selected theme independently from the system's current light or dark branch. */
  async function getState(): Promise<AppearanceState> {
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

  /** Recomputes the active branch when the system controls color mode. */
  const systemChanged = () => {
    if (preferences.mode === 'system') {
      changed.emit()
    }
  }
  nativeTheme.on('updated', systemChanged)
  const fontChanges = fonts.onInvalidated(() => changed.emit())
  /** Notifies catalog readers and all documents using the changed theme. */
  const invalidate = () => {
    directory.emit()
    changed.emit()
  }

  /** Catalog and persistence operations retain their theme-specific ownership. */
  const themes = {
    get,

    /** Resolves catalog text using this theme owner's fallback locale. */
    displayName(theme: Pick<Theme, 'ref' | 'name'>, locale: string) {
      return resolveLocalizedText(
        theme.name,
        locale,
        extensions.get(JSON.stringify(theme.ref))?.locale ?? 'en',
      )
    },

    /** Lists the complete catalog without acquiring its font files. */
    list: async () => [
      { ref: builtin.ref, name: builtin.name },
      ...(await call('listThemes')),
      ...[...extensions.values()].map(({ theme }) => ({ ref: theme.ref, name: theme.name })),
    ],

    /** Creates a complete user theme and invalidates its directory. */
    async create(input: UserThemeCreate) {
      const ref = await call('createTheme', input)
      invalidate()
      return ref
    },

    /** Copies private font sets once per source selection and commits them with the new theme. */
    async clone(ref: ThemeRef, input: { name: string }, options?: CallOptions) {
      const theme = await get(ref)
      if (!theme) {
        throw new DesktopError('NotFound', 'The selected theme is unavailable')
      }
      const source = extensions.get(JSON.stringify(ref))
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
              } finally {
                await read.dispose()
              }
              copies.set(key, copy)
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
        await Promise.all([...copies.values()].map((copy) => copy.dispose()))
      }
    },

    /** Commits the edited user theme and refreshes current consumers. */
    async update(id: string, input: UserThemeUpdate) {
      await call('updateTheme', id, input)
      invalidate()
    },

    /** Removes the definition while preserving references and independently held reads. */
    async delete(id: string) {
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
    ) {
      const ref = { type: 'extension' as const, extensionId, id }
      const key = JSON.stringify(ref)
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
        /** Replaces this live registration's validated two-branch definition. */
        update(input: ExtensionThemeDefinition) {
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
    async open(ref: ThemeRef): Promise<ThemeRead> {
      const theme = await get(ref)
      if (!theme) {
        throw new DesktopError('NotFound', 'The theme is unavailable')
      }
      const reads = new Map<string, Awaited<ReturnType<typeof acquire>>>()
      const fontResources: Record<
        ColorScheme,
        Partial<Record<FontTokenName, readonly ThemeFontResourceFile[]>>
      > = { light: {}, dark: {} }
      /** Releases all unique font sets acquired for this theme read. */
      const dispose = async () => {
        await Promise.all(
          [...reads.values()].map(async (read) => {
            await read?.dispose()
          }),
        )
      }
      try {
        for (const scheme of ['light', 'dark'] as const) {
          for (const slot of slots) {
            const font = theme[scheme][slot]
            const key = JSON.stringify(font)
            if (!reads.has(key)) {
              reads.set(key, await acquire(font, extensions.get(JSON.stringify(ref))?.read))
            }
            const read = reads.get(key)
            if (read) {
              fontResources[scheme][slot] = read.files
            }
          }
        }
        return { theme, fontResources, dispose }
      } catch (error) {
        await dispose()
        throw error
      }
    },

    onInvalidated: directory.on,
  }

  return {
    themes,
    getState,

    /** Delivers a first effective snapshot and rereads after changes for the lifetime of this observer. */
    async observe(listener: (state: AppearanceState) => void) {
      let active = true
      let queued = Promise.resolve()
      /** Queues an effective snapshot for this observer. */
      const deliver = () => {
        const snapshot = getState()
        queued = queued.then(async () => {
          const state = await snapshot
          if (active) {
            listener(state)
          }
        })
        return queued
      }
      const change = changed.on(() => deliver().catch(console.error))
      try {
        await deliver()
      } catch (error) {
        await change.dispose()
        throw error
      }
      return {
        /** Stops subsequent snapshots without modifying the selected theme. */
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
      changed.emit()
    },

    preview: previews.open,

    /** Resolves the current branch into CSS and independent resource URLs for one actual document. */
    async forView(view: ViewResourcesApi) {
      const preview = previews.current
      const state = await getState()
      const css = {
        ...defaults[state.colorScheme],
        ...state.tokens,
        '--font-sans': defaults[state.colorScheme]['--font-sans'],
        '--font-mono': defaults[state.colorScheme]['--font-mono'],
      }
      const faces: ViewFontFace[] = []
      const holds: ViewResourceBinding[] = []
      const issues = [...state.issues]
      /** Releases each document binding after replacement or failed acquisition. */
      const dispose = async () => {
        await Promise.all(holds.map((hold) => hold.dispose()))
      }
      try {
        for (const slot of slots) {
          const font = state.tokens[slot]
          if (font.type === 'system') {
            css[slot] = JSON.stringify(font.family) + ', ' + css[slot]
          } else if (font.type !== 'default') {
            try {
              const read = state.theme
                ? await acquire(font, extensions.get(JSON.stringify(state.theme))?.read)
                : null
              const files = read?.files ?? preview?.resources[slot]
              if (!files) {
                continue
              }
              try {
                const binding = await view.bind(
                  Object.fromEntries(files.map((file, i) => [String(i), file.resource])),
                )
                holds.push(binding)
                const family = 'Kisaki-' + randomUUID()
                css[slot] = family + ', ' + css[slot]
                files.forEach((file, i) =>
                  file.metadata.faces.forEach((face) => {
                    /** Formats a verified static or variable CSS font metric. */
                    const range = (value: typeof face.weight, suffix = '') =>
                      value.min + suffix + (value.min === value.max ? '' : ' ' + value.max + suffix)
                    faces.push({
                      family,
                      url: binding.urls[String(i)]!,
                      descriptors: {
                        weight: range(face.weight),
                        stretch: range(face.width, '%'),
                        style: face.style,
                      },
                    })
                  }),
                )
              } finally {
                await read?.dispose()
              }
            } catch {
              issues.push({
                code: 'fontUnavailable',
                slot,
                font,
                error: { code: 'FileUnavailable', message: 'The selected font is unavailable' },
              })
            }
          }
        }
        const appearance: ViewAppearance = {
          colorScheme: state.colorScheme,
          interfaceScale: state.interfaceScale,
          cssVariables: css,
          fontFaces: faces,
        }
        return { appearance, issues, dispose }
      } catch (error) {
        await dispose()
        throw error
      }
    },

    onChanged: changed.on,

    /** Releases system observation, the active preview and the font-library subscription. */
    async close(this: void) {
      nativeTheme.off('updated', systemChanged)
      await previews.close()
      await fontChanges.dispose()
    },
  }
}
