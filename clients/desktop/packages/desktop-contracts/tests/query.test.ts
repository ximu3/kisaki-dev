/** @fileoverview Exercises closed query predicates, mixed projections and stable interval/selection contracts. */

import { expect, test } from 'vitest'
import {
  entryLocateOffset,
  parseDynamicRules,
  parseEntryCondition,
  parseEntryListOptions,
  parseEntryQuery,
  parseEntrySelection,
} from '../src/library/query'
import {
  parseEntryGroupsResult,
  parseEntryListItem,
  parseEntryListResult,
  parseEntryLocateResult,
} from '../src/library/projections'
import type { EntryQuery } from '../src/library/query-values'

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

test('keeps zero, explicit null, precise dates and deduplicated selections meaningful', () => {
  expect(
    parseEntryCondition({ field: 'status', op: 'notIn', values: ['active', null, 'active'] }),
  ).toEqual({ field: 'status', op: 'notIn', values: ['active', null] })
  expect(
    parseEntryCondition({ field: 'rating', op: 'range', bounds: { min: 0, max: 0 } }),
  ).toMatchObject({ bounds: { min: 0, max: 0 } })
  expect(
    parseEntryCondition({
      field: 'birthDate',
      op: 'absoluteRange',
      bounds: { min: { year: 0 }, max: { year: 0 } },
    }),
  ).toMatchObject({ bounds: { min: { year: 0 } } })
  expect(
    parseEntryCondition({
      field: 'parts',
      scope: { partType: 'animeEpisode', classification: { op: 'in', values: [null] } },
      measure: 'accessible',
      op: 'range',
      bounds: { max: 0 },
    }),
  ).toMatchObject({ measure: 'accessible' })
  expect(() =>
    parseEntryCondition({
      field: 'parts',
      scope: { partType: 'novelVolume', classification: { op: 'in', values: [null] } },
      measure: 'registered',
      op: 'range',
      bounds: { min: 0 },
    }),
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

test('fixed group ranges require real expanded endpoints and preserve failed groups', () => {
  const group = { type: 'collection', id: 'c' } as const
  const endpoint = { group, ref: { type: 'game', id: 'g' } } as const
  expect(() =>
    parseEntrySelection({
      type: 'groupRange',
      anchor: endpoint,
      focus: endpoint,
      expandedGroups: [],
    }),
  ).toThrow()
  expect(
    parseEntrySelection({
      type: 'groupRange',
      anchor: endpoint,
      focus: endpoint,
      expandedGroups: [group],
    }),
  ).toMatchObject({ expandedGroups: [group] })
  const groups = {
    total: 2,
    groups: [
      {
        key: group,
        status: 'failed',
        error: { code: 'InvalidQuery', message: 'Invalid saved rule' },
      },
      {
        key: { type: 'unclassified' },
        status: 'failed',
        error: { code: 'InvalidQuery', message: 'Membership cannot be determined' },
      },
    ],
  }
  expect(parseEntryGroupsResult(groups)).toEqual(groups)
  expect(() =>
    parseDynamicRules({ search: '', rules: [], sort: { type: 'scope' }, referenceLabels: [] }),
  ).toThrow()
})
