/** @fileoverview Checks separate historical facts and mutually consistent completion baselines. */

import { expect, test } from 'vite-plus/test'
import { parseCompletionCreateMany } from './completions'
import { DesktopError } from '../errors'

test('completion creation preserves separate facts and rejects conflicting baselines', () => {
  const first = {
    work: { type: 'game', id: 'g' },
    completedDate: { year: 2026, month: 11, day: 3 },
    note: '  ',
  }

  const second = { ...first, expected: { completionCount: 2 } }

  expect(parseCompletionCreateMany([first, second])).toHaveLength(2)

  expect(() =>
    parseCompletionCreateMany([{ ...first, expected: { completionCount: 1 } }, second]),
  ).toThrow(DesktopError)
})
