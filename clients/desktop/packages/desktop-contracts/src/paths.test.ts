/** @fileoverview Checks portable absolute paths and root-relative filter syntax. */

import { expect, test } from 'vite-plus/test'
import { parseAbsolutePath, parsePathFilter } from './paths'

test('absolute inputs preserve host spellings and require complete Windows roots', () => {
  for (const path of [
    '/shelf',
    'c:/shelf',
    '\\\\?\\c:\\shelf',
    '\\\\server\\share',
    '\\\\.\\UNC\\server\\share',
  ]) {
    expect(parseAbsolutePath(path)).toBe(path)
  }
  for (const path of [
    'C:shelf',
    '\\\\server',
    '\\\\?\\c:shelf',
    '\\\\?\\UNC',
    '\\\\?\\UNC\\server',
    '\\\\.\\UNC\\server\\',
  ]) {
    expect(() => parseAbsolutePath(path)).toThrow()
  }
})

test('path filters reject ambiguous recursion and parent traversal', () => {
  expect(() => parsePathFilter({ kind: 'glob', pattern: 'a**b', ignoreCase: false })).toThrow()

  expect(() => parsePathFilter({ kind: 'path', path: '../outside' })).toThrow()
})
