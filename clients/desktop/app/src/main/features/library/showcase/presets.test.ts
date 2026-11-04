/** @fileoverview Checks localized native presets produce independent editable configuration values. */

import { expect, test } from 'vitest'
import { createTranslator } from '@kisaki3/desktop-localization'
import { parseShowcaseFields } from '@kisaki3/desktop-contracts/library'
import { getShowcasePresets } from './presets'

test('catalog labels use the current translation and adopted draft titles retain their original text', () => {
  const chinese = createTranslator('zh-CN', {
    showcase: { presets: { recentlyUsed: { name: '最近使用' } } },
  })
  const presets = getShowcasePresets(chinese)
  expect(presets).toHaveLength(10)
  for (const preset of presets) {
    expect(parseShowcaseFields(preset.initial)).toEqual(preset.initial)
  }
  const draft = structuredClone(presets[0]!.initial)
  expect(draft.name).toBe('最近使用')
  expect(getShowcasePresets(createTranslator('en'))[0]!.initial.name).toBe('Recently used')
  expect(draft.name).toBe('最近使用')
  expect(getShowcasePresets(chinese)[0]!.initial).not.toBe(presets[0]!.initial)
})
