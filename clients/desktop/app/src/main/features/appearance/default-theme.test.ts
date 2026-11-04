/** @fileoverview Verifies the built-in theme combines shared visual defaults with the effective message snapshot. */

import { expect, test } from 'vitest'
import { createTranslator } from '@kisaki3/desktop-localization'
import { light } from '@kisaki3/desktop-appearance/defaults'
import { getDefaultTheme } from './default-theme'

test('the built-in theme localizes its name and retains desktop font choices', () => {
  const theme = getDefaultTheme(
    createTranslator('zh-CN', { appearance: { themes: { default: '默认' } } }),
  )
  expect(theme.name).toBe('默认')
  expect(theme.light).toEqual({
    ...light,
    '--font-sans': { type: 'default' },
    '--font-mono': { type: 'default' },
  })
})
