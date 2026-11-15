/** @fileoverview Verifies entry condition value semantics, field constraints and relation qualifiers. */

import { test, expect } from 'vite-plus/test'

import { parseEntryCondition } from './conditions'

test('rejects unknown fields, invalid value ranges and unsupported condition combinations', () => {
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
