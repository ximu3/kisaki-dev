/** @fileoverview Verifies path filters behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { matchesPathFilter, fileRuleBaseName } from './path-filters'
import { parsePathFilter } from '@kisaki3/desktop-contracts/paths'

test('glob recursion matches zero levels and question marks count Unicode code points', () => {
  const equals = (a: string, b: string): boolean => a === b
  const filter = { kind: 'glob', pattern: '**/*.cbz', ignoreCase: false } as const

  expect(matchesPathFilter(filter, '01.cbz', equals)).toBe(true)
  expect(matchesPathFilter(filter, 'a/b/01.cbz', equals)).toBe(true)
  expect(matchesPathFilter(filter, '01.CBZ', equals)).toBe(false)

  expect(matchesPathFilter({ ...filter, ignoreCase: true }, '01.CBZ', equals)).toBe(true)

  expect(
    matchesPathFilter({ kind: 'glob', pattern: '?.cbz', ignoreCase: false }, '😀.cbz', equals),
  ).toBe(true)

  expect(matchesPathFilter({ kind: 'path', path: '[group]/*.cbz' }, '[group]/01.cbz', equals)).toBe(
    false,
  )

  expect(() => parsePathFilter({ kind: 'glob', pattern: 'a**b', ignoreCase: false })).toThrow()

  expect(() => parsePathFilter({ kind: 'path', path: '../outside' })).toThrow()

  expect(fileRuleBaseName('.hidden', 'file')).toBe('.hidden')
  expect(fileRuleBaseName('book.tar.gz', 'file')).toBe('book.tar')
})
