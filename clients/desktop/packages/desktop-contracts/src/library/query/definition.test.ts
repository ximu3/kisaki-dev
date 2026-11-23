import { test, expect } from 'vite-plus/test'

import { parseEntryQuery, type EntryQuery } from './definition'

const query: EntryQuery = {
  scope: { type: 'library' },
  search: '',
  rules: [{ enabled: true, types: ['game', 'person'], filter: { match: 'all', conditions: [] } }],
  sort: { type: 'field', field: 'name', direction: 'asc' },
}

test('checks disabled groups, sort applicability and the exact entrance definition', () => {
  expect(() =>
    parseEntryQuery({
      ...query,
      rules: [
        {
          enabled: false,
          types: ['person'],
          filter: { match: 'all', conditions: [{ field: 'status', op: 'in', values: [null] }] },
        },
      ],
    }),
  ).toThrow()

  expect(() =>
    parseEntryQuery({ ...query, sort: { type: 'field', field: 'releaseDate', direction: 'asc' } }),
  ).toThrow()

  expect(() =>
    parseEntryQuery({ ...query, scope: { type: 'library', showHidden: true } }),
  ).toThrow()
})
