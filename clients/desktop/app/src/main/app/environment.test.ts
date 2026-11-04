/** @fileoverview Verifies environment behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { formatApplicationEnvironment } from './environment'
import { parseApplicationEnvironment } from '@kisaki3/desktop-contracts/app'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { dataModeRequiresRestart } from './data-mode'
import { parseStrictJson, parseJsonValue } from '@kisaki3/desktop-contracts/json'

test('safe environment and data-mode projections report actual scope without paths in clipboard content', () => {
  const environment = {
    version: '1.0.0',
    operatingSystem: { name: 'Example OS', version: '1' },
    architecture: 'arm64' as const,
  }

  expect(formatApplicationEnvironment(environment)).toBe('Kisaki 1.0.0\nExample OS 1\narm64')

  expect(() => parseApplicationEnvironment({ ...environment, dataRoot: '/private' })).toThrow(
    DesktopError,
  )

  expect(
    dataModeRequiresRestart({
      current: { mode: 'normal', path: '/normal' },
      normalPath: '/normal',
      portable: { status: 'available', path: '/portable', nextMode: 'portable' },
    }),
  ).toBe(true)

  expect(
    dataModeRequiresRestart({
      current: { mode: 'normal', path: '/normal' },
      normalPath: '/normal',
      portable: {
        status: 'unavailable',
        error: { code: 'ReadFailed', message: 'Marker unavailable' },
      },
    }),
  ).toBeNull()
  expect(() => parseStrictJson('{"a":1,"\\u0061":2}')).toThrow(DesktopError)

  const sparse: number[] = []
  sparse.length = 2
  sparse[1] = 1

  expect(() => parseJsonValue(sparse)).toThrow(DesktopError)
})
