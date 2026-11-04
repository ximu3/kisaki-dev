/** @fileoverview Verifies conditions behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { parseEntryCondition } from './conditions'
import { parseEntryQuery } from './definition'
import type { EntryQuery } from './definition'

const query: EntryQuery = {
  scope: { type: 'library' },
  search: '',
  rules: [{ enabled: true, types: ['game', 'person'], filter: { match: 'all', conditions: [] } }],
  sort: { type: 'field', field: 'name', direction: 'asc' },
}

test('rejects unknown and incompatible clauses even in disabled groups', () => {
  for (const condition of [
    { field: 'rating', op: 'range', bounds: { min: 101 } },
    { field: 'rating', op: 'range', bounds: {} },
    { field: 'status', op: 'in', values: ['completed'] },
    { field: 'tags', op: 'all', values: [] },
    { field: 'favorite', op: 'is', value: true, sql: 'ignored?' },
    { field: 'effectiveAddedDate', op: 'absent' },
    { field: 'createdAt', op: 'calendarRange', bounds: { min: { year: 2024, day: 2 } } },
    { field: 'birthDate', op: 'monthDayRange', from: { month: 2, day: 30 }, to: { month: 3 } },
    { field: 'unknown', op: 'present' },
  ]) {
    expect(() => parseEntryCondition(condition)).toThrow()
  }

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

test('retains same-fact relation qualifiers and rejects impossible or extra qualifier keys', () => {
  const relation = {
    field: 'workPersons',
    targets: { op: 'any', values: [{ type: 'person', id: 'p' }] },
    where: { personRoles: ['voiceActor'], characterRoles: ['main'] },
  }

  expect(parseEntryCondition(relation)).toEqual(relation)

  expect(() =>
    parseEntryCondition({ ...relation, where: { ...relation.where, character: { type: 'none' } } }),
  ).toThrow()

  expect(() =>
    parseEntryCondition({
      ...relation,
      field: 'characterPersons',
      where: { characterRoles: ['main'] },
    }),
  ).toThrow()

  expect(() =>
    parseEntryCondition({
      ...relation,
      targets: { op: 'any', values: [{ type: 'character', id: 'p' }] },
    }),
  ).toThrow()
})
