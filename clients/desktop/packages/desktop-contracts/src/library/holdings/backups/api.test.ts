/** @fileoverview Verifies explicit operation intent at the backup creation boundary. */

import { expect, test } from 'vitest'
import { parseGameBackupCreateInput } from './api'
import { DesktopError } from '../../../errors'

test('requires an explicit unchanged-content policy instead of choosing one for the caller', () => {
  const source = { type: 'config', launchConfigId: 'config' }

  expect(() => parseGameBackupCreateInput({ source })).toThrow(DesktopError)
  expect(parseGameBackupCreateInput({ source, skipIfUnchanged: false })).toEqual({
    source,
    skipIfUnchanged: false,
  })
})
