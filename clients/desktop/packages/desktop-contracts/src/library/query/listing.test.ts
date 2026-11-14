/** @fileoverview Verifies query result intervals, counts and target location stay internally consistent. */

import { test, expect } from 'vite-plus/test'
import { parseEntryQuery } from './definition'
import type { EntryQuery } from './definition'

import { parseEntryListResult, entryLocateOffset, parseEntryLocateResult } from './listing'

/** Mixed game/person query reused by the interval and group-listing validation cases. */
const query: EntryQuery = {
  scope: { type: 'library' },
  search: '',
  rules: [{ enabled: true, types: ['game', 'person'], filter: { match: 'all', conditions: [] } }],
  sort: { type: 'field', field: 'name', direction: 'asc' },
}

test('empty rules stay empty, while real intervals and location replies remain internally consistent', () => {
  const empty = parseEntryQuery({ ...query, rules: [] })

  expect(empty.rules).toEqual([])

  expect(() =>
    parseEntryListResult({ total: 1, items: [] }, empty, { offset: 0, limit: 80 }),
  ).toThrow()
  expect(entryLocateOffset(99, 100, 20)).toBe(80)
  expect(entryLocateOffset(3, 10, 20)).toBe(0)

  expect(parseEntryListResult({ total: 12, items: [] }, query, { offset: 50, limit: 10 })).toEqual({
    total: 12,
    items: [],
  })

  const result = { total: 1, index: 0, offset: 0, items: [{ id: 'g', type: 'game', name: 'Game' }] }

  expect(parseEntryLocateResult(result, query, { type: 'game', id: 'g' }, { limit: 10 })).toEqual(
    result,
  )

  expect(() =>
    parseEntryLocateResult(result, query, { type: 'game', id: 'other' }, { limit: 10 }),
  ).toThrow()
})
