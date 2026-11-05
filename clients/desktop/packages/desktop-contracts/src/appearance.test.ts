/** @fileoverview Verifies desktop error classification at the shared visual-value boundary. */

import { expect, test } from 'vitest'
import { defaults } from '@kisaki3/desktop-appearance/defaults'
import { parseUserThemeUpdate, parseViewAppearance } from './appearance'
import { DesktopError } from './errors'

test('accepts complete view values and translates visual parser failures with their cause', () => {
  const appearance = {
    colorScheme: 'light',
    interfaceScale: 100,
    cssVariables: defaults.light,
    fontFaces: [],
  }

  expect(() => parseViewAppearance(appearance)).not.toThrow()

  for (const cssVariables of [{}, { ...defaults.light, '--primary': 'not-a-color' }]) {
    try {
      parseViewAppearance({ ...appearance, cssVariables })
      throw new Error('Expected invalid appearance to be rejected')
    } catch (error) {
      if (!(error instanceof DesktopError)) {
        throw error
      }

      expect(error.code).toBe('InvalidInput')
      expect(error.cause).toBeInstanceOf(TypeError)
    }
  }
})

test('conditional theme edits validate opaque bases and accept individual chart slots', () => {
  const edit = {
    changes: { light: { '--chrome': '#ffffff', '--chart-5': '#947115' } },
    expected: { light: { '--chrome': '#dde1e5' } },
  }
  expect(parseUserThemeUpdate(edit)).toEqual(edit)

  expect(() =>
    parseUserThemeUpdate({ ...edit, expected: { light: { '--chrome': 'transparent' } } }),
  ).toThrow(DesktopError)
})
