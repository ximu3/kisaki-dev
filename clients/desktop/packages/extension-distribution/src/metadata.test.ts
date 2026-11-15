/** @fileoverview Verifies opaque identities and static text matching across locales and writing systems. */

import { expect, test } from 'vite-plus/test'
import {
  normalizeLocalizedText,
  normalizeLocale,
  parseCategory,
  parseId,
  resolveLocalizedText,
} from './metadata'

test('IDs allow single and dotted segments without deriving author identity', () => {
  for (const id of ['a', 'author-name', 'author.package-2', 'x3.language.zh-hans']) {
    expect(parseId(id)).toBe(id)
  }

  for (const id of ['', 'A', '1a', '-a', 'a-', 'a..b', 'a._b', ' a', 'a\n', 'a\r\n', 'a\u2028']) {
    expect(() => parseId(id)).toThrow(expect.objectContaining({ code: 'invalid-format' }))
  }
})

test('new category declarations use the supported vocabulary', () => {
  expect(parseCategory('language')).toBe('language')
  expect(() => parseCategory('future-category')).toThrow(
    expect.objectContaining({ code: 'invalid-format' }),
  )
})

test('locale normalization rejects alias collisions and missing defaults without changing text', () => {
  expect(normalizeLocale('EN-us')).toBe('en-US')
  expect(normalizeLocalizedText({ 'EN-us': '  Hello {name}  ' }, 'en-US')).toEqual({
    'en-US': '  Hello {name}  ',
  })

  expect(() => normalizeLocalizedText({ en: 'A', EN: 'B' }, 'en')).toThrow(
    'Duplicate normalized locale',
  )
  expect(() => normalizeLocalizedText({ iw: 'A', he: 'B' }, 'he')).toThrow(
    'Duplicate normalized locale',
  )
  expect(() => normalizeLocalizedText({ fr: 'Bonjour' }, 'en')).toThrow('default locale')

  expect(() => normalizeLocale('zh_CN')).toThrow(
    expect.objectContaining({ path: [], code: 'invalid-format' }),
  )
})

test('matching preserves exact labels, same-script regional variants and deterministic candidate order', () => {
  const text = { en: 'English', 'zh-Hans': '简体', 'zh-Hant': '繁體', 'en-GB': 'British' }

  expect(resolveLocalizedText(text, 'zh-CN', 'en')).toBe('简体')
  expect(resolveLocalizedText(text, 'zh-TW', 'en')).toBe('繁體')
  expect(resolveLocalizedText(text, 'EN-gb', 'en')).toBe('British')
  expect(resolveLocalizedText(text, 'fr', 'en')).toBe('English')

  expect(resolveLocalizedText(text, 'en-AU', 'en')).toBe(
    resolveLocalizedText(Object.fromEntries(Object.entries(text).reverse()), 'en-AU', 'en'),
  )
  expect(resolveLocalizedText('Literal {key}', 'zh-CN', 'en')).toBe('Literal {key}')
})

test('script mismatches use the explicit default rather than a related language candidate', () => {
  expect(resolveLocalizedText({ en: 'Default', 'zh-Hant': '繁體' }, 'zh-CN', 'en')).toBe('Default')
  expect(resolveLocalizedText({ 'zh-Hant': '作者預設' }, 'zh-CN', 'zh-Hant')).toBe('作者預設')

  expect(resolveLocalizedText({ en: 'Default', 'sr-Latn': 'Latin' }, 'sr-Cyrl', 'en')).toBe(
    'Default',
  )
  expect(resolveLocalizedText({ en: 'Default', fr: 'French' }, 'br', 'en')).toBe('Default')
})
