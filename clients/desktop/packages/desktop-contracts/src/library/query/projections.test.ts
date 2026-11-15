/** @fileoverview Verifies mixed entry projections preserve requested and applicable field boundaries. */

import { test, expect } from 'vitest'

import { parseEntryListOptions } from './listing'
import type { EntryQuery } from './definition'
import { parseEntryListItem } from './projections'

/** Mixed game/person query reused by the keyed projection validation cases. */
const query: EntryQuery = {
  scope: { type: 'library' },
  search: '',
  rules: [{ enabled: true, types: ['game', 'person'], filter: { match: 'all', conditions: [] } }],
  sort: { type: 'field', field: 'name', direction: 'asc' },
}

test('mixed projections omit inapplicable and unrequested fields instead of forging null', () => {
  expect(parseEntryListOptions({ offset: 0, limit: 80, fields: ['status'] }, query)).toMatchObject({
    fields: ['status'],
  })

  expect(parseEntryListItem({ id: 'p', type: 'person', name: 'Person' }, ['status'])).toEqual({
    id: 'p',
    type: 'person',
    name: 'Person',
  })

  expect(() =>
    parseEntryListItem({ id: 'p', type: 'person', name: 'Person', status: null }, ['status']),
  ).toThrow()

  expect(() => parseEntryListItem({ id: 'g', type: 'game', name: 'Game' }, ['status'])).toThrow()

  expect(() =>
    parseEntryListItem({ id: 'g', type: 'game', name: 'Game', favorite: false }),
  ).toThrow()

  expect(() => parseEntryListOptions({ offset: 0, limit: 201 }, query)).toThrow()

  expect(() =>
    parseEntryListOptions({ offset: 0, limit: 80, fields: ['declaredPageCount'] }, query),
  ).toThrow()
})
