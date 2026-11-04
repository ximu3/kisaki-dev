/** @fileoverview Verifies timing behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { activityDurationInRange } from './timing'
import { parseActivityCreate } from '@kisaki3/desktop-contracts/library'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

test('activity ranges allocate the recorded duration and do not apply manual future checks to historical reads', () => {
  const activity = { startedAt: 1000, endedAt: 5000, durationMs: 2000 }

  expect(activityDurationInRange(activity, { from: 1000, to: 3000 })).toBe(1000)

  expect(activityDurationInRange(activity, { from: 5000, to: 6000 })).toBe(0)

  expect(() =>
    parseActivityCreate({ work: { type: 'novel', id: 'n' }, ...activity }, 4000),
  ).toThrow(DesktopError)

  expect(
    parseActivityCreate({ work: { type: 'novel', id: 'n' }, ...activity }, 5000),
  ).not.toHaveProperty('context')

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
