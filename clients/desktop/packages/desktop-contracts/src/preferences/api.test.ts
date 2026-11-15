/** @fileoverview Checks changed preference fields and credential comparison baselines. */

import { expect, test } from 'vite-plus/test'
import { parsePreferencesUpdate } from './api'
import { DesktopError } from '../errors'

test('preference updates compare only submitted fields and require credential state', () => {
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
