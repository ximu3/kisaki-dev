/** @fileoverview Verifies clues behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { mergeIdentificationClues } from './identification'

test('confirmed clue merge preserves whole date precision and exact source identity', () => {
  expect(
    mergeIdentificationClues('game', [
      {
        name: 'First',
        releaseDate: { year: 0 },
        externalIdentities: [{ source: 'example', sourceId: 'work/A' }],
      },
      {
        name: 'Second',
        releaseDate: { year: 0, month: 2, day: 29 },
        externalIdentities: [
          { source: 'example', sourceId: 'work/A' },
          { source: 'example', sourceId: 'work/a' },
        ],
      },
    ]),
  ).toEqual({
    name: 'First',
    releaseDate: { year: 0 },
    externalIdentities: [
      { source: 'example', sourceId: 'work/A' },
      { source: 'example', sourceId: 'work/a' },
    ],
  })
})
