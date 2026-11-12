/** @fileoverview Checks catalog snapshots, fallback language and complete source-call validation. */

import { expect, test } from 'vitest'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { createTranslator, validateExtensionUiTranslationDefinition } from './translate'

test('missing leaves use English plural rules while present leaves use the explicit locale', () => {
  const fallback = createTranslator('zh-CN')
  expect(fallback('library.selection', { count: 1 })).toBe('1 item selected')

  const translated = createTranslator('zh-CN', {
    library: { selection: '{count, plural, one {one} other {other}}' },
  })
  expect(translated('library.selection', { count: 1 })).toBe('other')
})

test('an empty translated leaf is present and source arguments remain required after omission', () => {
  const t = createTranslator('zh-CN', { library: { selection: '' } })
  expect(t('library.selection', { count: 2 })).toBe('')
  for (const args of [
    ['library.selection'],
    ['library.selection', { count: '2' }],
    ['actions.save', { extra: 1 }],
    ['unknown.key'],
  ]) {
    expect(() => {
      void Reflect.apply(t, undefined, args)
    }).toThrow(DesktopError)
  }
})

test('same-locale translators and later catalog changes cannot share stale message caches', () => {
  const catalog = { actions: { save: '保存' } }
  const first = createTranslator('zh-CN', catalog)
  expect(first('actions.save')).toBe('保存')

  catalog.actions.save = '存储'
  const second = createTranslator('zh-CN', catalog)

  expect(second('actions.save')).toBe('存储')
  expect(first('actions.save')).toBe('保存')
})

test('markup and inserted ICU-looking text remain literal text', () => {
  const t = createTranslator('en', { library: { completion: { recorded: '<b>{name}</b>' } } })
  expect(t('library.completion.recorded', { name: '{count, number}' })).toBe(
    '<b>{count, number}</b>',
  )
})

test('registration rejects the entire catalog for malformed known messages and retains unknown leaves', () => {
  const registration = {
    id: 'test',
    name: 'Test',
    locale: 'zh-hans-cn',
    messages: { actions: { save: '保存' } },
  }
  expect(() =>
    validateExtensionUiTranslationDefinition({
      ...registration,
      messages: {
        ...registration.messages,
        library: { selection: '{count, plural, one {one} other {{count, number, ::currency/US}}}' },
      },
    }),
  ).toThrow(DesktopError)

  const value = validateExtensionUiTranslationDefinition({
    ...registration,
    messages: { future: '{not current ICU' },
  })
  expect(value.messages).toEqual({ future: '{not current ICU' })
})
