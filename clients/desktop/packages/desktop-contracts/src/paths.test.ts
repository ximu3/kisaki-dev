/** @fileoverview Checks literal path and glob filter syntax without evaluating file matches. */

import { expect, test } from 'vitest'
import { parsePathFilter } from './paths'

test('path filters reject ambiguous recursion and parent traversal', () => {
  expect(() => parsePathFilter({ kind: 'glob', pattern: 'a**b', ignoreCase: false })).toThrow()

  expect(() => parsePathFilter({ kind: 'path', path: '../outside' })).toThrow()
})
