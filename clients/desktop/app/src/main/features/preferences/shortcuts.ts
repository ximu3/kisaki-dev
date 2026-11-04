/** @fileoverview Chooses the native shortcut defaults for the actual desktop platform. */

import type {
  DesktopPlatform,
  ShortcutsPreferences,
  ShortcutKey,
  ShortcutPreferences,
} from '@kisaki3/desktop-contracts/preferences'
import { shortcutKeys, parseAccelerator } from '@kisaki3/desktop-contracts/preferences'

/** Defaults are product choices, never inferred from operating-system registration success. */
export function getShortcutDefaults(platform: DesktopPlatform): ShortcutsPreferences {
  const fullScreen = platform === 'darwin' ? 'Command+Control+F' : 'F11'
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
    'reader.fullscreen': [fullScreen],
    'reader.addAnnotation': ['CommandOrControl+Shift+A'],
    'reader.toggleAnnotations': ['CommandOrControl+Shift+L'],

    'player.playPause': ['Space'],
    'player.seekBackward': ['Left'],
    'player.seekForward': ['Right'],
    'player.volumeUp': ['Up'],
    'player.volumeDown': ['Down'],
    'player.toggleMute': ['M'],
    'player.toggleSubtitles': ['V'],
    'player.fullscreen': [fullScreen],
    'player.addAnnotation': ['CommandOrControl+Shift+A'],
    'player.toggleAnnotations': ['CommandOrControl+Shift+L'],

    'game.addAnnotation': ['Shift+F9'],
    'game.togglePanel': ['Shift+F8'],
  }
  return Object.fromEntries(
    shortcutKeys.map((key): [ShortcutKey, ShortcutPreferences] => [
      key,
      { enabled: true, accelerators: (bindings[key] ?? []).map(parseAccelerator) },
    ]),
  ) as ShortcutsPreferences
}
