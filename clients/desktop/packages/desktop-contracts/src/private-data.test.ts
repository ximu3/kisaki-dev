/** @fileoverview Verifies private mutations preserve JSON null, deletion intent and independent revision comparisons. */

import { it, expect } from 'vite-plus/test'

import { parsePrivateCommit } from './private-data'
import { DesktopError } from './errors'

it('keeps private JSON null distinct from deletion and compares only explicitly requested keys', () => {
  const input = {
    values: [{ type: 'set', key: 'state', value: null, expectedRevision: null }],
    secrets: [{ type: 'delete', key: 'state', expectedRevision: 'revision' }],
  }

  expect(parsePrivateCommit(input)).toEqual(input)

  expect(() =>
    parsePrivateCommit({
      values: [
        { type: 'set', key: 'state', value: 1 },
        { type: 'delete', key: 'state' },
      ],
    }),
  ).toThrow(DesktopError)
})
