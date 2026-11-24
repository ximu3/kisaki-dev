import {
  parsePreferences,
  shortcutKeys,
  type DesktopPlatform,
  type Preferences,
  type ReadingPreferences,
  type ShortcutKey,
  type ShortcutsPreferences,
} from '@kisaki3/desktop-contracts/preferences'
import type { PageRef } from '@kisaki3/desktop-contracts/ui'
import type { UiTranslationRef } from '@kisaki3/desktop-contracts/i18n'

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
    shortcutKeys.map((key) => [key, bindings[key] ?? []]),
  ) as ShortcutsPreferences
}

export function getPreferenceDefaults(
  platform: DesktopPlatform,
  navigationOrder: readonly PageRef[],
  uiTranslation: UiTranslationRef = { type: 'builtin', id: 'en' },
): Preferences {
  return parsePreferences(
    {
      general: { uiTranslation, closeMainWindow: 'background' },
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
