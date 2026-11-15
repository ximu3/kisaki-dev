/** @fileoverview Owns initial preference values shared by database initialization and explicit default requests. */

import { parsePreferences, shortcutKeys } from '@kisaki3/desktop-contracts/preferences'
import type {
  DesktopPlatform,
  Preferences,
  ReadingPreferences,
  ShortcutKey,
  ShortcutsPreferences,
} from '@kisaki3/desktop-contracts/preferences'
import type { PageRef } from '@kisaki3/desktop-contracts/ui'

/** Creates independent complete reading defaults without consulting the reading engine. */
function readingDefaults(): ReadingPreferences {
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

/** Creates the fixed shortcut catalog using the selected desktop platform's fullscreen binding. */
function shortcutDefaults(platform: DesktopPlatform): ShortcutsPreferences {
  const fullscreen = platform === 'darwin' ? 'Control+Command+F' : 'F11'
  const bindings: Partial<Record<ShortcutKey, readonly string[]>> = {
    'main.search': ['CommandOrControl+Shift+F'],
    'main.preferences': ['CommandOrControl+,'],
    'editor.save': ['CommandOrControl+S'],
    'reader.find': ['CommandOrControl+F'],
    'reader.left': ['Left'],
    'reader.right': ['Right'],
    'reader.up': ['Up'],
    'reader.down': ['Down'],
    'reader.previous': ['PageUp', 'Shift+Space'],
    'reader.next': ['PageDown', 'Space'],
    'reader.fullscreen': [fullscreen],
    'reader.addAnnotation': ['CommandOrControl+Shift+A'],
    'reader.toggleAnnotations': ['CommandOrControl+Shift+L'],
    'player.playPause': ['Space'],
    'player.seekBackward': ['Left'],
    'player.seekForward': ['Right'],
    'player.volumeUp': ['Up'],
    'player.volumeDown': ['Down'],
    'player.toggleMute': ['M'],
    'player.toggleSubtitles': ['V'],
    'player.fullscreen': [fullscreen],
    'player.addAnnotation': ['CommandOrControl+Shift+A'],
    'player.toggleAnnotations': ['CommandOrControl+Shift+L'],
    'game.addAnnotation': ['Shift+F9'],
    'game.togglePanel': ['Shift+F8'],
  }
  return Object.fromEntries(
    shortcutKeys.map((key) => [
      key,
      {
        enabled: true,
        accelerators: bindings[key] ?? [],
      },
    ]),
  ) as ShortcutsPreferences
}

/**
 * Returns a fresh complete preference value for initialization or a reset draft.
 *
 * The application supplies the actual native page-catalog order; no pages or resources are created.
 */
export function getPreferenceDefaults(
  platform: DesktopPlatform,
  navigationOrder: readonly PageRef[],
): Preferences {
  return parsePreferences(
    {
      general: { uiTranslation: { type: 'builtin', id: 'en' }, closeMainWindow: 'background' },
      appearance: {
        theme: { type: 'builtin', id: 'default' },
        mode: 'system',
        interfaceScale: 100,
      },
      navigation: { order: navigationOrder, visibleLimit: 7 },
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
        comic: readingDefaults(),
        novel: readingDefaults(),
      },
      playback: { volumePercent: 100, muted: false },
      shortcuts: shortcutDefaults(platform),
      network: { mode: 'system', endpoint: null, bypassRules: '', credentials: null },
      updates: { autoCheck: true, allowPrerelease: false },
    },
    platform,
  )
}
