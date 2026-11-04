/** @fileoverview Verifies fields behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { selectMetadataFieldValue } from './fields'

test('field answers preserve unanswered, explicit empty, false and zero meanings', () => {
  expect(
    selectMetadataFieldValue(
      { object: 'entry', entryType: 'anime', field: 'declaredDurationMs' },
      [undefined, null, 0, 10],
      'first',
    ),
  ).toBeNull()

  expect(
    selectMetadataFieldValue(
      { object: 'entry', entryType: 'anime', field: 'declaredDurationMs' },
      [undefined, null, 0, 10],
      'firstNonEmpty',
    ),
  ).toBe(0)

  expect(
    selectMetadataFieldValue(
      { object: 'entry', entryType: 'anime', field: 'isNsfw' },
      [false, true],
      'firstNonEmpty',
    ),
  ).toBe(false)

  expect(
    selectMetadataFieldValue(
      { object: 'entry', entryType: 'game', field: 'aliases' },
      [undefined, []],
      'union',
    ),
  ).toEqual([])

  expect(
    selectMetadataFieldValue(
      { object: 'entry', entryType: 'game', field: 'aliases' },
      [undefined],
      'union',
    ),
  ).toBeUndefined()

  expect(
    selectMetadataFieldValue(
      { object: 'entry', entryType: 'game', field: 'aliases' },
      [[' A '], ['a', 'A B']],
      'union',
    ),
  ).toEqual([' A ', 'A B'])
})
