/** @fileoverview Checks result targets remain inside the requested search category. */

import { expect, test } from 'vitest'
import { parseSearchResult } from './search'
import { DesktopError } from './errors'

test('search categories accept only their own result target kinds', () => {
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
})
