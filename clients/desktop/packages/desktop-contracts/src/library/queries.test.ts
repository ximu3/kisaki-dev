/** @fileoverview Verifies finite query operands, mixed projections, and stable interval selection. */

import { expect, it } from 'vitest'
import {
  calculateLocateOffset,
  parseEntryCondition,
  parseEntryQuery,
  parseEntrySelection,
} from './queries'
import { parseEntryListItem, parseEntryListOptions } from './projections'

function query(types: readonly string[], conditions: readonly unknown[], enabled = true) {
  return {
    scope: { type: 'library' },
    search: '',
    rules: [{ enabled, types, filter: { match: 'all', conditions } }],
    sort: { type: 'scope' },
  }
}

it('preserves explicitly empty rules and validates disabled groups without executing their references', () => {
  expect(
    parseEntryQuery({ scope: { type: 'library' }, search: '', rules: [], sort: { type: 'scope' } })
      .rules,
  ).toEqual([])
  expect(
    parseEntryQuery(
      query(['game'], [{ field: 'tags', op: 'any', values: ['deleted-tag'] }], false),
    ),
  ).toBeDefined()
  expect(() =>
    parseEntryQuery(query(['person'], [{ field: 'status', op: 'in', values: [null] }], false)),
  ).toThrow()
  expect(() =>
    parseEntryQuery(query(['game', 'person'], [{ field: 'status', op: 'in', values: [null] }])),
  ).toThrow()
  expect(() =>
    parseEntryQuery({
      ...query(['game', 'person'], []),
      sort: { type: 'field', field: 'status', direction: 'asc' },
    }),
  ).toThrow()
  expect(() =>
    parseEntryQuery({
      ...query(['game', 'person'], []),
      sort: { type: 'field', field: 'releaseDate', direction: 'asc' },
    }),
  ).toThrow()
})

it.each([
  { field: 'rating', op: 'range', bounds: { min: 101 } },
  { field: 'rating', op: 'range', bounds: {} },
  { field: 'age', op: 'range', bounds: { min: 2, max: 1 } },
  { field: 'tags', op: 'all', values: [] },
  { field: 'status', op: 'in', values: ['completed'] },
  { field: 'totalDurationMs', op: 'absent' },
  { field: 'releaseDate', op: 'absoluteRange', bounds: { min: { year: 2024, day: 3 } } },
  { field: 'birthDate', op: 'monthDayRange', from: { month: 2, day: 30 }, to: { month: 3 } },
  { field: 'effectiveAddedDate', op: 'absent' },
  { field: 'createdAt', op: 'instantRange', from: 5, to: 5 },
  { field: 'createdAt', op: 'instantRange' },
  {
    field: 'parts',
    scope: { partType: 'comicVolume', classification: { op: 'in', values: [null] } },
    measure: 'registered',
    op: 'range',
    bounds: { min: 1 },
  },
  { field: 'unknown', op: 'present' },
])('rejects an invalid or inapplicable operand: %j', (condition) => {
  expect(() => parseEntryCondition(condition)).toThrow(
    expect.objectContaining({ code: 'InvalidInput' }),
  )
})

it('normalizes repeated selections and retains null as an explicit enum value', () => {
  expect(
    parseEntryCondition({ field: 'status', op: 'notIn', values: ['active', null, 'active'] }),
  ).toEqual({ field: 'status', op: 'notIn', values: ['active', null] })
  expect(parseEntryCondition({ field: 'cupSize', op: 'equals', value: ' AA ' })).toMatchObject({
    value: ' AA ',
  })
})

it('checks relation qualifiers against the actual field and rejects contradictory character scopes', () => {
  const condition = {
    field: 'workCharacterPersons',
    targets: { op: 'notEmpty' },
    where: { character: { type: 'none' } },
  }
  expect(() => parseEntryQuery(query(['game'], [condition]))).toThrow()
  expect(() =>
    parseEntryCondition({
      field: 'workCharacters',
      targets: { op: 'notEmpty' },
      where: { personRoles: ['creator'] },
    }),
  ).toThrow()
  expect(() =>
    parseEntryQuery(
      query(
        ['comic'],
        [
          {
            field: 'parts',
            scope: { partType: 'animeEpisode' },
            measure: 'registered',
            op: 'range',
            bounds: { min: 1 },
          },
        ],
      ),
    ),
  ).toThrow()
})

it('returns only requested applicable row fields and refuses fabricated mixed-kind nulls', () => {
  expect(parseEntryListItem({ id: 'person', type: 'person', name: 'Author' }, ['status'])).toEqual({
    id: 'person',
    type: 'person',
    name: 'Author',
  })
  expect(
    parseEntryListItem({ id: 'game', type: 'game', name: 'Game', status: null }, ['status']),
  ).toMatchObject({ status: null })
  expect(() => parseEntryListItem({ id: 'game', type: 'game', name: 'Game' }, ['status'])).toThrow()
  expect(() =>
    parseEntryListItem({ id: 'person', type: 'person', name: 'Author', status: null }, ['status']),
  ).toThrow()
  expect(() => parseEntryListItem({ id: 'game', type: 'game', name: 'Game', rating: 0 })).toThrow()
  expect(() =>
    parseEntryListOptions({ offset: 0, limit: 20, fields: ['status'] }, ['person']),
  ).toThrow()
  expect(
    parseEntryListOptions({ offset: 0, limit: 20, fields: ['status'] }, ['person', 'game']),
  ).toBeDefined()
})

it('keeps bounded read intervals separate from unlimited fixed-identity selection', () => {
  expect(() => parseEntryListOptions({ offset: 0, limit: 201 })).toThrow()
  expect(calculateLocateOffset(50, 100, 20)).toBe(40)
  expect(calculateLocateOffset(99, 100, 20)).toBe(80)
  expect(calculateLocateOffset(0, 2, 200)).toBe(0)
  expect(parseEntrySelection({ type: 'all' })).toEqual({ type: 'all' })
  const endpoint = { group: { type: 'unclassified' }, ref: { type: 'game', id: 'game' } }
  expect(() =>
    parseEntrySelection({
      type: 'groupRange',
      anchor: endpoint,
      focus: endpoint,
      expandedGroups: [],
    }),
  ).toThrow()
})
