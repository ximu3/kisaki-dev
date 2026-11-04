/** @fileoverview Verifies excerpts behavior using isolated synthetic inputs. */

import { it, expect } from 'vitest'

import { parseSearchResult } from '@kisaki3/desktop-contracts/search'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { truncateSearchExcerpt } from './excerpts'

it('keeps search categories and grapheme-safe excerpt boundaries', () => {
  const item = {
    target: { type: 'collection', id: 'c' },
    title: 'Collection',
    context: null,
    excerpt: null,
    imageId: null,
    icon: null,
  }

  expect(parseSearchResult('catalog', { items: [item], total: 1 }).items).toHaveLength(1)

  expect(() => parseSearchResult('notes', { items: [item], total: 1 })).toThrow(DesktopError)
  expect(truncateSearchExcerpt('a'.repeat(159) + 'e\u0301' + 'x')).toBe('a'.repeat(159))
  expect(truncateSearchExcerpt('a'.repeat(158) + '👨‍👩‍👧‍👦')).toBe('a'.repeat(158))
})
