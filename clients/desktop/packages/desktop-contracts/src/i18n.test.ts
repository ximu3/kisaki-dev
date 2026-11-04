/** @fileoverview Checks generic catalog values independently of any English product messages. */

import { expect, test } from 'vitest'
import { DesktopError } from './errors'
import { parseMessageCatalog, parseUiTranslationRegistration } from './i18n'

test('catalog parsing preserves literal leaves and returns independent ordinary data', () => {
  const source = { domain: { empty: '', future: '{unparsed' } }
  const parsed = parseMessageCatalog(source)
  source.domain.empty = 'changed'
  expect(parsed).toEqual({ domain: { empty: '', future: '{unparsed' } })
  expect(parseMessageCatalog(JSON.parse('{"__proto__":{"constructor":"literal"}}'))).toEqual(
    JSON.parse('{"__proto__":{"constructor":"literal"}}'),
  )
})

test('registration validates shape and owner-local identity without reading a product catalog', () => {
  const value = parseUiTranslationRegistration({
    id: 'test',
    name: 'Test',
    locale: 'en-us-u-nu-latn',
    messages: { future: '{unparsed' },
  })
  expect(value.locale).toBe('en-US')
  const cycle: Record<string, unknown> = {}
  cycle.child = cycle
  for (const input of [cycle, { 'dotted.key': 'text' }, { value: 1 }, { value: [] }, new Date()]) {
    expect(() => parseMessageCatalog(input)).toThrow(DesktopError)
  }
})
