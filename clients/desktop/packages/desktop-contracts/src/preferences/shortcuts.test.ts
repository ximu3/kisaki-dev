/** @fileoverview Checks canonical shortcut syntax without accepting duplicate modifiers or invalid keys. */

import { expect, test } from 'vitest'
import { parseAccelerator } from './shortcuts'
import { DesktopError } from '../errors'

test('accelerators preserve supported aliases and reject invalid combinations', () => {
  expect(parseAccelerator('shift+ctrl+s')).toBe('Control+Shift+S')

  expect(parseAccelerator('Control++')).toBe('Control+Plus')

  expect(() => parseAccelerator('Control+Control+A')).toThrow(DesktopError)

  expect(() => parseAccelerator('F25')).toThrow(DesktopError)
})
