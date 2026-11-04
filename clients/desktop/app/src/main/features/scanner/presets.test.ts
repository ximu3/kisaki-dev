/** @fileoverview Checks native clue templates keep localized labels separate from their one rule definition. */

import { expect, test } from 'vitest'
import { createTranslator } from '@kisaki3/desktop-localization'
import { getClueExtractionPresets } from './presets'

test('localized labels leave the ordered native extraction definitions unchanged', () => {
  const english = getClueExtractionPresets(createTranslator('en'))
  const chinese = getClueExtractionPresets(
    createTranslator('zh-CN', { scanner: { presets: { bracketBoth: { name: '移除两端附注' } } } }),
  )
  expect(chinese[0]!.name).toBe('移除两端附注')
  expect(chinese.map(({ id, rule }) => ({ id, rule }))).toEqual(
    english.map(({ id, rule }) => ({ id, rule })),
  )
})
