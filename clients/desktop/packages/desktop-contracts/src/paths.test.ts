/** @fileoverview Checks literal discovery paths, finite globs, and Unicode path-component semantics. */

import { expect, it } from 'vitest'
import { matchesPathFilter, parsePathFilter } from './paths'

const exact = { pathEquals: (left: string, right: string) => left === right }

it('keeps exact filename metacharacters literal and delegates filesystem equality', () => {
  const filter = parsePathFilter({ kind: 'path', path: '[Group]/A?.cbz' })
  expect(matchesPathFilter(filter, '[Group]/A?.cbz', exact)).toBe(true)
  expect(matchesPathFilter(filter, 'Group/AB.cbz', exact)).toBe(false)
  expect(
    matchesPathFilter({ kind: 'path', path: 'A' }, 'a', {
      pathEquals: (left, right) => left.toLowerCase() === right.toLowerCase(),
    }),
  ).toBe(true)
})

it('matches zero-depth globstars, complete components and single Unicode code points', () => {
  const filter = parsePathFilter({ kind: 'glob', pattern: '**/[组] ?.cbz', ignoreCase: false })
  expect(matchesPathFilter(filter, '[组] 😀.cbz', exact)).toBe(true)
  expect(matchesPathFilter(filter, 'a/b/[组] 😀.cbz', exact)).toBe(true)
  expect(matchesPathFilter(filter, '[组] ab.cbz', exact)).toBe(false)
  expect(
    matchesPathFilter({ kind: 'glob', pattern: '*.cbz', ignoreCase: true }, 'a/A.CBZ', exact),
  ).toBe(false)
  expect(
    matchesPathFilter({ kind: 'glob', pattern: '*.cbz', ignoreCase: true }, 'A.CBZ', exact),
  ).toBe(true)
  expect(matchesPathFilter({ kind: 'glob', pattern: '**', ignoreCase: false }, '.', exact)).toBe(
    true,
  )
  expect(
    matchesPathFilter(
      { kind: 'glob', pattern: '*.cbz', ignoreCase: false },
      'line\nbreak.cbz',
      exact,
    ),
  ).toBe(true)
})

it('rejects traversal and malformed globstars without normalizing them into a broader filter', () => {
  for (const pattern of ['/root', 'a/', 'a//b', '../a', 'a/./b', 'a\\b', 'C:/a', 'a**b']) {
    expect(() => parsePathFilter({ kind: 'glob', pattern, ignoreCase: false })).toThrow()
  }
  expect(parsePathFilter({ kind: 'path', path: '.' })).toEqual({ kind: 'path', path: '.' })
  expect(parsePathFilter({ kind: 'path', path: ' ' })).toEqual({ kind: 'path', path: ' ' })
})

it('handles repeated wildcards without enumerating every partition and keeps Unicode case matching', () => {
  const pattern = '*a'.repeat(18) + 'b'
  expect(
    matchesPathFilter({ kind: 'glob', pattern, ignoreCase: false }, 'a'.repeat(36), exact),
  ).toBe(false)
  expect(
    matchesPathFilter({ kind: 'glob', pattern, ignoreCase: false }, 'a'.repeat(36) + 'b', exact),
  ).toBe(true)
  expect(matchesPathFilter({ kind: 'glob', pattern: 's?k', ignoreCase: true }, 'ſ😀K', exact)).toBe(
    true,
  )
})
