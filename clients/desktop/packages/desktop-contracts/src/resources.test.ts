/** @fileoverview Verifies public file boundaries preserve legal header keys and reject unsafe credential redirects. */

import { expect, it } from 'vitest'
import { parseFileInput } from './resources'

it('preserves all ordinary own header keys without invoking prototype setters', () => {
  const headers = Object.fromEntries([
    ['constructor', 'test'],
    ['__proto__', 'test'],
  ])
  const value = parseFileInput({ type: 'url', url: 'https://example.test/image', headers })
  expect(value).toEqual({ type: 'url', url: 'https://example.test/image', headers })
  if (value.type !== 'url') {
    throw new Error('Expected URL input.')
  }
  expect(Object.hasOwn(value.headers ?? {}, '__proto__')).toBe(true)
  expect(() =>
    parseFileInput({
      type: 'url',
      url: 'https://example.test/image',
      headers: { Authorization: 'test' },
    }),
  ).toThrow()
})
