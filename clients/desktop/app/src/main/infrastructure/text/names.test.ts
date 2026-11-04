/** @fileoverview Verifies names behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  normalizeNfkc,
  normalizeNfc,
  normalizeNameForSort,
  compareNaturalNames,
  createTagNameKey,
} from './names'

test('passes the official Unicode 18 NFKC conformance vectors', async () => {
  const source = await readFile(
    join(import.meta.dirname, '../../../../assets/unicode/18.0.0/NormalizationTest.txt'),
    'utf8',
  )
  let checked = 0
  for (const line of source.split(/\r?\n/)) {
    const content = line.split('#')[0]!.trim()
    if (!content || content.startsWith('@')) {
      continue
    }

    const columns = content
      .split(';')
      .slice(0, 5)
      .map((column) =>
        column
          .trim()
          .split(' ')
          .map((point) => String.fromCodePoint(Number.parseInt(point, 16)))
          .join(''),
      )
    for (const [index, column] of columns.entries()) {
      expect(normalizeNfkc(column), `NFKC row ${checked + 1}`).toBe(columns[3])
      expect(normalizeNfc(column), `NFC row ${checked + 1}`).toBe(columns[index < 3 ? 1 : 3])
    }
    checked += 1
  }

  expect(checked).toBeGreaterThan(20_000)
})

test('uses full default folding and stable natural number semantics', () => {
  expect(normalizeNameForSort('Straße')).toBe(normalizeNameForSort('STRASSE'))
  expect(compareNaturalNames('A2', 'ａ２')).toBe(0)
  expect(compareNaturalNames('é', 'e\u0301')).toBe(0)

  for (const [left, right] of [
    ['作品2', '作品10'],
    ['作品2', '作品02'],
    ['作品02', '作品0002'],
    ['作品02a', '作品2b'],
    ['八', '阿'],
    ['file9', 'file١٠'],
    ['a-b', 'a2'],
    ['a2', 'a:b'],
    ['作品9007199254740992', '作品9007199254740993'],
    ['a', 'a0'],
    ['a0', 'a00'],
  ] as const) {
    expect(compareNaturalNames(left, right)).toBe(-1)
    expect(compareNaturalNames(right, left)).toBe(1)
  }

  expect(compareNaturalNames('a2b002', 'a02b2')).toBe(-1)
})

test('keeps tag matching distinct from identity and full case-fold name ordering', () => {
  expect(createTagNameKey('  ＰＣ  ')).toBe('pc')
  expect(createTagNameKey(' A\t B ')).toBe('a b')
  expect(createTagNameKey('C++')).not.toBe(createTagNameKey('C'))
  expect(createTagNameKey('Straße')).not.toBe(createTagNameKey('STRASSE'))
  expect(() => normalizeNfkc('\ud800')).toThrow()
})
