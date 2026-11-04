/** @fileoverview Verifies definition behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { parseEntryCondition } from './conditions'

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
