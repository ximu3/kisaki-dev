/** @fileoverview Checks bounded search inputs, category type correlation, and complete grapheme excerpts. */

import { expect, expectTypeOf, it } from 'vitest'
import {
  parseSearchOptions,
  parseSearchQuery,
  truncateSearchExcerpt,
  type SearchItem,
  type SearchTargetMap,
} from './search'

it('preserves category-specific targets rather than widening single categories to unrelated objects', () => {
  expectTypeOf<SearchTargetMap['notes']>().toEqualTypeOf<{
    readonly type: 'note'
    readonly id: string
  }>()
  expectTypeOf<SearchTargetMap['fonts']>().toEqualTypeOf<{
    readonly type: 'font'
    readonly id: string
  }>()
  expectTypeOf<SearchItem<'catalog'>['target']['type']>().toEqualTypeOf<
    'entry' | 'part' | 'collection' | 'tag'
  >()
})

it('rejects invented categories and oversized reads without clamping', () => {
  expect(parseSearchQuery({ text: '', category: 'catalog' }).text).toBe('')
  expect(() => parseSearchQuery({ text: 'name', category: 'all' })).toThrow()
  expect(() => parseSearchOptions({ offset: 0, limit: 201 })).toThrow()
})

it('retains complete combining characters and emoji sequences at the UTF-16 excerpt boundary', () => {
  const prefix = 'x'.repeat(159)
  expect(truncateSearchExcerpt(prefix + 'e\u0301')).toBe(prefix)
  expect(truncateSearchExcerpt(prefix + '👩‍👩‍👧‍👧')).toBe(prefix)
  expect(truncateSearchExcerpt('x'.repeat(160) + 'z')).toHaveLength(160)
})
