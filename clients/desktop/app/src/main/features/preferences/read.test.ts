/** @fileoverview Checks independent stored-field recovery and unavailable identity definitions. */

import { expect, test } from 'vitest'
import { getPreferencesDefaults } from './defaults'
import { readPreferences } from './read'

test('defaults only an invalid ordinary field and keeps malformed identities and proxy definitions unavailable', () => {
  const defaults = getPreferencesDefaults('win32', [])

  const value = readPreferences(
    {
      ...defaults,
      library: { showNsfw: 'bad', autoRefreshHoldings: false },
      usage: {
        ...defaults.usage,
        anime: { ...defaults.usage.anime, playbackSpeed: 0, subtitleScale: 2 },
      },
      network: { ...defaults.network, mode: 'manual', endpoint: 'broken' },
      general: {
        ...defaults.general,
        uiTranslation: { type: 'extension', extensionId: 'missing.translation', id: 'zh' },
      },
    },
    defaults,
  )

  expect(value.library).toEqual({ showNsfw: true, autoRefreshHoldings: false })
  expect(value.usage.anime.playbackSpeed).toBe(1)
  expect(value.usage.anime.subtitleScale).toBe(2)
  expect(value.network.status).toBe('invalid')
  expect(value.general.uiTranslation).toEqual({
    status: 'ready',
    value: { type: 'extension', extensionId: 'missing.translation', id: 'zh' },
  })
})
