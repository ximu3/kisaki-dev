/** @fileoverview Checks canonical shortcut syntax and conflicts between effective key combinations. */

import { expect, test } from 'vite-plus/test'
import { parseAccelerator, findShortcutConflicts, shortcutKeys } from './shortcuts'
import type { ShortcutPreferences, ShortcutsPreferences } from './shortcuts'
import { DesktopError } from '../errors'

test('accelerators preserve supported aliases and reject invalid combinations', () => {
  expect(parseAccelerator('shift+ctrl+s')).toBe('Control+Shift+S')

  expect(parseAccelerator('Control++')).toBe('Control+Plus')

  expect(() => parseAccelerator('Control+Control+A')).toThrow(DesktopError)

  expect(() => parseAccelerator('F25')).toThrow(DesktopError)
})

test('conflicts follow Electron modifier aliases and implicit shifted key codes', () => {
  const preferences = Object.fromEntries<ShortcutPreferences>(
    shortcutKeys.map((key) => [key, { enabled: false, accelerators: [] }]),
  ) as ShortcutsPreferences

  for (const [first, second, conflicts] of [
    ['Control+Option+F24', 'Control+Alt+F24', 1],
    ['Control+Option+F24', 'Control+F24', 0],
    ['Command+F23', 'Super+F23', 1],
    ['Control+Alt+!', 'Control+Alt+Shift+1', 1],
    ['Control+Alt+Plus', 'Control+Alt+Shift+=', 1],
  ] as const) {
    const bindings = {
      ...preferences,
      'main.search': { enabled: true, accelerators: [first] },
      'main.preferences': { enabled: true, accelerators: [second] },
    }
    for (const platform of ['win32', 'linux', 'darwin'] as const) {
      expect(findShortcutConflicts(bindings, platform)).toHaveLength(conflicts)
    }
  }
})
