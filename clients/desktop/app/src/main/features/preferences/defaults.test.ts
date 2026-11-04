/** @fileoverview Checks complete platform defaults and their legal update baselines. */

import { expect, test } from 'vitest'
import { getPreferencesDefaults } from './defaults'
import {
  parsePreferences,
  findShortcutConflicts,
  parsePreferencesUpdate,
} from '@kisaki3/desktop-contracts/preferences'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

test('round trips complete defaults and compares only changed fields, including credential state', () => {
  for (const platform of ['win32', 'darwin', 'linux'] as const) {
    const defaults = getPreferencesDefaults(platform, [{ type: 'native', id: 'library' }])

    expect(parsePreferences(defaults, platform)).toEqual(defaults)
    expect(findShortcutConflicts(defaults.shortcuts, platform)).toEqual([])
  }

  expect(
    parsePreferencesUpdate({
      changes: { navigation: { visibleLimit: 3 } },
      expected: { navigation: { visibleLimit: 7 } },
    }).changes.navigation,
  ).toEqual({ visibleLimit: 3 })

  expect(() =>
    parsePreferencesUpdate({
      changes: { usage: { comic: { text: { fontSize: 22 } } } },
      expected: { usage: { comic: { text: { lineHeight: 2 } } } },
    }),
  ).toThrow(DesktopError)

  expect(() => parsePreferencesUpdate({ changes: { network: { credentials: null } } })).toThrow(
    DesktopError,
  )

  expect(
    parsePreferencesUpdate({
      changes: { network: { credentials: { username: 'name', password: 'secret' } } },
      expected: { network: { credentials: null } },
    }).expected?.network?.credentials,
  ).toBeNull()
})
