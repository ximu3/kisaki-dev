/** @fileoverview Checks the public application environment excludes private data paths. */

import { expect, test } from 'vitest'
import { parseApplicationEnvironment } from './app'
import { DesktopError } from './errors'

test('environment values reject private filesystem information', () => {
  const environment = {
    version: '1.0.0',
    operatingSystem: { name: 'Example OS', version: '1' },
    architecture: 'arm64' as const,
  }

  expect(() => parseApplicationEnvironment({ ...environment, dataRoot: '/private' })).toThrow(
    DesktopError,
  )
})
