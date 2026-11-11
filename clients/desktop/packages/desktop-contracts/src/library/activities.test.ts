/** @fileoverview Checks activity creation time and work-specific context values. */

import { expect, test } from 'vitest'
import { parseActivityCreate } from './activities'
import { DesktopError } from '../errors'

test('activity creation requires integer duration, past intervals and compatible work context', () => {
  const activity = { startedAt: 1000, endedAt: 5000, durationMs: 2000 }

  expect(() =>
    parseActivityCreate({ work: { type: 'novel', id: 'n' }, ...activity }, 4000),
  ).toThrow(DesktopError)

  expect(
    parseActivityCreate({ work: { type: 'novel', id: 'n' }, ...activity }, 5000),
  ).not.toHaveProperty('context')

  expect(() =>
    parseActivityCreate({ work: { type: 'novel', id: 'n' }, ...activity, durationMs: 0.5 }, 5000),
  ).toThrow(DesktopError)

  expect(() =>
    parseActivityCreate(
      {
        work: { type: 'novel', id: 'n' },
        ...activity,
        context: { fileId: null, part: { type: 'comicChapter', id: 'c' } },
      },
      5000,
    ),
  ).toThrow(DesktopError)
})
