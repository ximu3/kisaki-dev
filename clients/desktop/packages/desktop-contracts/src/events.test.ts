/** @fileoverview Verifies extension event identities and delivery through their declared payload parser. */

import { test, expect } from 'vite-plus/test'

import { parseExtensionEventRef, extensionEvent, parseExtensionEventPayload } from './events'
import { DesktopError } from './errors'

test('extension events bind their finite reference and parser', () => {
  expect(() => parseExtensionEventRef('app.ready')).toThrow(DesktopError)
  expect(() => parseExtensionEventRef('example:local:extra')).toThrow(DesktopError)

  const contract = extensionEvent('example.ext:changed', (value) => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
      throw new TypeError('Expected an integer')
    }
    return value
  })

  expect(parseExtensionEventPayload(contract, 3)).toBe(3)
  expect(() => parseExtensionEventPayload(contract, '3')).toThrow(TypeError)
})
