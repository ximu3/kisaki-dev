/** @fileoverview Projects stored preferences without repairing storage or turning invalid definitions into executable defaults. */

import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { StoredDefinition } from '@kisaki3/desktop-contracts/operations'
import { parseUiTranslationRef } from '@kisaki3/desktop-contracts/i18n'
import { parseThemeRef } from '@kisaki3/desktop-contracts/appearance'
import { parseNetworkPreferences } from '@kisaki3/desktop-contracts/network'
import {
  parsePreferencesUpdate,
  parseReadingPreferencesChanges,
  parseShortcutPreferences,
  shortcutKeys,
} from '@kisaki3/desktop-contracts/preferences'
import type {
  Preferences,
  PreferencesSnapshot,
  ReadingPreferences,
  ReadingPreferencesSnapshot,
} from '@kisaki3/desktop-contracts/preferences'

function stored<T>(parse: (value: unknown) => T, value: unknown): StoredDefinition<T> {
  try {
    return { status: 'ready', value: parse(value) }
  } catch (error) {
    if (!(error instanceof DesktopError) || error.code !== 'InvalidInput') {
      throw error
    }
    return {
      status: 'invalid',
      error: { code: 'DataIntegrityError', message: 'Stored preference is unavailable' },
    }
  }
}

function group(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === null || prototype === Object.prototype
    ? (value as Record<string, unknown>)
    : {}
}

function ordinary<T>(parse: (value: unknown) => T, value: unknown, fallback: T): T {
  const result = stored(parse, value)
  return result.status === 'ready' ? result.value : fallback
}

/** Validate siblings independently through the owning partial-value parser. */
function ordinaryFields<T extends object>(
  parse: (value: unknown) => Partial<T>,
  input: unknown,
  defaults: T,
): T {
  const source = group(input)
  return Object.fromEntries(
    (Object.keys(defaults) as (keyof T & string)[]).map((key) => [
      key,
      ordinary((raw) => parse({ [key]: raw })[key]!, source[key], defaults[key]),
    ]),
  ) as T
}

function readReading(input: unknown, fallback: ReadingPreferences): ReadingPreferencesSnapshot {
  const value = group(input)
  const rawText = group(value.text)
  const textDefaults = Object.fromEntries(
    Object.entries(fallback.text).filter(([key]) => key !== 'font'),
  ) as Omit<ReadingPreferences['text'], 'font'>
  return {
    flow: ordinary(
      (raw) => parseReadingPreferencesChanges({ flow: raw }).flow!,
      value.flow,
      fallback.flow,
    ),
    colors: ordinary(
      (raw) => parseReadingPreferencesChanges({ colors: raw }).colors!,
      value.colors,
      fallback.colors,
    ),
    pages: ordinaryFields(
      (raw) => parseReadingPreferencesChanges({ pages: raw }).pages!,
      value.pages,
      fallback.pages,
    ),
    text: {
      ...ordinaryFields(
        (raw) => parseReadingPreferencesChanges({ text: raw }).text!,
        value.text,
        textDefaults,
      ),
      font: stored(
        (raw) => parseReadingPreferencesChanges({ text: { font: raw } }).text!.font!,
        rawText.font,
      ),
    },
  }
}

/** Invalid identity, order and proxy definitions remain unavailable; ordinary fields recover independently. */
export function readPreferences(input: unknown, defaults: Preferences): PreferencesSnapshot {
  const value = group(input)
  const general = group(value.general)
  const appearance = group(value.appearance)
  const navigation = group(value.navigation)
  const usage = group(value.usage)
  const shortcuts = group(value.shortcuts)

  return {
    general: {
      closeMainWindow: ordinary(
        (raw) =>
          parsePreferencesUpdate({ changes: { general: { closeMainWindow: raw } } }).changes
            .general!.closeMainWindow!,
        general.closeMainWindow,
        defaults.general.closeMainWindow,
      ),
      uiTranslation: stored(parseUiTranslationRef, general.uiTranslation),
    },
    appearance: {
      mode: ordinary(
        (raw) =>
          parsePreferencesUpdate({ changes: { appearance: { mode: raw } } }).changes.appearance!
            .mode!,
        appearance.mode,
        defaults.appearance.mode,
      ),
      interfaceScale: ordinary(
        (raw) =>
          parsePreferencesUpdate({ changes: { appearance: { interfaceScale: raw } } }).changes
            .appearance!.interfaceScale!,
        appearance.interfaceScale,
        defaults.appearance.interfaceScale,
      ),
      theme: stored(parseThemeRef, appearance.theme),
    },
    navigation: {
      visibleLimit: ordinary(
        (raw) =>
          parsePreferencesUpdate({ changes: { navigation: { visibleLimit: raw } } }).changes
            .navigation!.visibleLimit!,
        navigation.visibleLimit,
        defaults.navigation.visibleLimit,
      ),
      order: stored(
        (raw) =>
          parsePreferencesUpdate({ changes: { navigation: { order: raw } } }).changes.navigation!
            .order!,
        navigation.order,
      ),
    },
    library: ordinaryFields(
      (raw) => parsePreferencesUpdate({ changes: { library: raw } }).changes.library!,
      value.library,
      defaults.library,
    ),
    playback: ordinaryFields(
      (raw) => parsePreferencesUpdate({ changes: { playback: raw } }).changes.playback!,
      value.playback,
      defaults.playback,
    ),
    updates: ordinaryFields(
      (raw) => parsePreferencesUpdate({ changes: { updates: raw } }).changes.updates!,
      value.updates,
      defaults.updates,
    ),
    usage: {
      foregroundGracePeriodMs: ordinary(
        (raw) =>
          parsePreferencesUpdate({ changes: { usage: { foregroundGracePeriodMs: raw } } }).changes
            .usage!.foregroundGracePeriodMs!,
        usage.foregroundGracePeriodMs,
        defaults.usage.foregroundGracePeriodMs,
      ),
      game: ordinaryFields(
        (raw) => parsePreferencesUpdate({ changes: { usage: { game: raw } } }).changes.usage!.game!,
        usage.game,
        defaults.usage.game,
      ),
      anime: ordinaryFields(
        (raw) =>
          parsePreferencesUpdate({ changes: { usage: { anime: raw } } }).changes.usage!.anime!,
        usage.anime,
        defaults.usage.anime,
      ),
      comic: readReading(usage.comic, defaults.usage.comic),
      novel: readReading(usage.novel, defaults.usage.novel),
    },
    shortcuts: Object.fromEntries(
      shortcutKeys.map((key) => {
        const raw = group(shortcuts[key])
        return [
          key,
          {
            enabled: ordinary(
              (enabled) => parseShortcutPreferences({ enabled, accelerators: [] }).enabled,
              raw.enabled,
              defaults.shortcuts[key].enabled,
            ),
            accelerators: stored(
              (accelerators) =>
                parseShortcutPreferences({ enabled: true, accelerators }).accelerators,
              raw.accelerators,
            ),
          },
        ]
      }),
    ) as PreferencesSnapshot['shortcuts'],
    network: stored(parseNetworkPreferences, value.network),
  }
}
