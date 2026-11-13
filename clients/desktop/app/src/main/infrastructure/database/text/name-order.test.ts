/** @fileoverview Checks Unicode normalization against the fixed upstream conformance corpus and name-key ordering. */

import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { expect, test } from 'vitest'
import inputs from '../../../../../assets/unicode/inputs.json' with { type: 'json' }
import { normalizeNfkc } from './normalization'
import { compareNames } from './name-order'

test('Unicode 18 normalization passes the fixed UAX #15 conformance data', () => {
  const source = gunzipSync(
    readFileSync(
      new URL('../../../../../tests/fixtures/unicode/NormalizationTest.txt.gz', import.meta.url),
    ),
  )
  expect(createHash('sha256').update(source).digest('hex')).toBe(
    inputs.files['NormalizationTest.txt'],
  )
  for (const line of source.toString('utf8').split('\n')) {
    if (!/^[0-9A-F]/u.test(line)) {
      continue
    }
    const columns = line
      .split(';')
      .slice(0, 5)
      .map((column) =>
        column
          .trim()
          .split(' ')
          .filter(Boolean)
          .map((point) => String.fromCodePoint(Number.parseInt(point, 16)))
          .join(''),
      )
    for (const input of columns) {
      expect(normalizeNfkc(input), line).toBe(columns[3])
    }
  }
})

test('natural keys defer all decimal-width comparisons and preserve the fixed Unicode equivalences', () => {
  const ordered = ['a-b', 'a2', 'a02', 'a02a', 'a2b', 'a9', 'a١٠', 'a:b', '八', '阿']
  expect([...ordered].reverse().sort(compareNames)).toEqual(ordered)
  expect(compareNames('A2', 'ａ２')).toBe(0)
  expect(compareNames('Straße', 'STRASSE')).toBe(0)
  expect(compareNames('é', 'e\u0301')).toBe(0)
  expect(compareNames('作品9007199254740992', '作品9007199254740993')).toBeLessThan(0)
})
