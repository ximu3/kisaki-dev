/** @fileoverview Checks real interval boundaries and proportional duration without inventing session or completion facts. */

import { describe, expect, it } from 'vitest'
import { allocateActivityDuration, parseActivityCreate, parseActivityUpdate } from './activities'

describe('activity intervals', () => {
  it('allocates measured duration by overlap, including fractional milliseconds and touching endpoints', () => {
    const interval = { startedAt: 0, endedAt: 60_000, durationMs: 30_000 }
    expect(allocateActivityDuration(interval, 0, 30_000)).toBe(15_000)
    expect(allocateActivityDuration(interval, 60_000, 120_000)).toBe(0)
    expect(allocateActivityDuration({ startedAt: 0, endedAt: 3, durationMs: 1 }, 0, 1)).toBeCloseTo(
      1 / 3,
    )
  })

  it('accepts work-only manual activity and rejects future or impossible durations', () => {
    expect(
      parseActivityCreate('novel', { startedAt: 100, endedAt: 200, durationMs: 50 }, 200),
    ).toEqual({ startedAt: 100, endedAt: 200, durationMs: 50 })
    expect(() =>
      parseActivityCreate('game', { startedAt: 100, endedAt: 201, durationMs: 50 }, 200),
    ).toThrow()
    expect(() =>
      parseActivityCreate('game', { startedAt: 100, endedAt: 200, durationMs: 101 }, 200),
    ).toThrow()
  })

  it('keeps context immutable during ordinary corrections and requires the complete comparison group', () => {
    expect(() =>
      parseActivityUpdate('anime', { changes: { context: { fileId: 'new' } } }),
    ).toThrow()
    expect(() =>
      parseActivityUpdate('anime', {
        changes: { durationMs: 5 },
        expected: { activity: { startedAt: 1, endedAt: 10, durationMs: 9 } },
      }),
    ).toThrow()
    expect(() =>
      parseActivityCreate(
        'anime',
        {
          startedAt: 1,
          endedAt: 10,
          durationMs: 9,
          context: { fileId: null, episodeId: 'e', extraId: 'x' },
        },
        10,
      ),
    ).toThrow()
  })
})
