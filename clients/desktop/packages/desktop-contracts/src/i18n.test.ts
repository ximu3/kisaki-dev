/** @fileoverview Checks generic catalog values independently of any English product messages. */

import { expect, test } from 'vite-plus/test'
import { DesktopError } from './errors'
import { parseMessageCatalog, parseExtensionUiTranslationDefinition } from './i18n'

test('catalogs copy plain data properties and reject invalid groups', () => {
  const source = { domain: { empty: '', future: '{unparsed' } }
  const parsed = parseMessageCatalog(source)
  source.domain.empty = 'changed'
  expect(parsed).toEqual({ domain: { empty: '', future: '{unparsed' } })
  expect(parseMessageCatalog(JSON.parse('{"__proto__":{"constructor":"literal"}}'))).toEqual(
    JSON.parse('{"__proto__":{"constructor":"literal"}}'),
  )

  const cycle: Record<string, unknown> = {}
  cycle.child = cycle
  const accessor = {
    /** Fails if catalog parsing invokes this accessor instead of rejecting it as non-data. */
    get message(): string {
      throw new Error('Catalog parsing invoked a getter')
    },
  }
  for (const input of [
    cycle,
    accessor,
    { 'dotted.key': 'text' },
    { value: 1 },
    { value: [] },
    new Date(),
  ]) {
    expect(() => parseMessageCatalog(input)).toThrow(DesktopError)
  }
})

test('registration canonicalizes the locale and retains unknown product messages', () => {
  const value = parseExtensionUiTranslationDefinition({
    id: 'test',
    name: 'Test',
    locale: 'en-us-u-nu-latn',
    messages: { future: '{unparsed' },
  })
  expect(value.locale).toBe('en-US')
  expect(value.messages).toEqual({ future: '{unparsed' })
})
