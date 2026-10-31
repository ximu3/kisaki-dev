/** @fileoverview Checks exact and script-compatible locale matching without changing user content. */

import { expect, it } from 'vitest'
import { parseLocalizedText, resolveLocalizedText } from './metadata'

it('normalizes locale keys and rejects collisions and missing defaults', () => {
  expect(parseLocalizedText({ 'en-us': 'Name' }, 'en-US')).toEqual({ 'en-US': 'Name' })
  expect(() => parseLocalizedText({ 'en-us': 'a', 'en-US': 'b' }, 'en-US')).toThrow()
  expect(() => parseLocalizedText({ ja: '名前' }, 'en')).toThrow()
  expect(() =>
    parseLocalizedText(
      Object.fromEntries([
        ['en', 'Name'],
        ['__proto__', 'Invalid locale'],
      ]),
      'en',
    ),
  ).toThrow()
})

it('matches within a language and script and uses the owner fallback without script conversion', () => {
  const values = { en: 'Default', 'zh-Hans': '简体', 'zh-Hant': '繁體', 'en-GB': 'British' }
  expect(resolveLocalizedText(values, 'zh-CN', 'en')).toBe('简体')
  expect(resolveLocalizedText(values, 'zh-TW', 'en')).toBe('繁體')
  expect(resolveLocalizedText({ en: 'Default', 'zh-Hans': '简体' }, 'zh-Hant', 'en')).toBe(
    'Default',
  )
  expect(resolveLocalizedText(values, 'ja', 'en')).toBe('Default')
  expect(resolveLocalizedText({ en: 'Default', ja: '' }, 'ja', 'en')).toBe('')
  expect(resolveLocalizedText('Literal {name}', 'ja', 'en')).toBe('Literal {name}')
})
