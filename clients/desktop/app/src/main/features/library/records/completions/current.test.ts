/** @fileoverview Verifies current behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { parseCompletionCreateMany } from '@kisaki3/desktop-contracts/library'
import { parseRecordCurrentMany } from './current'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

test('history insertion preserves separate facts while current-completion intent coalesces equivalent works', () => {
  const first = {
    work: { type: 'game', id: 'g' },
    completedDate: { year: 2026, month: 11, day: 3 },
    note: '  ',
  }
  const second = { ...first, expected: { completionCount: 2 } }

  expect(parseCompletionCreateMany([first, second])).toHaveLength(2)

  expect(parseRecordCurrentMany([first, second])).toEqual([{ ...second, note: null }])

  expect(() =>
    parseCompletionCreateMany([{ ...first, expected: { completionCount: 1 } }, second]),
  ).toThrow(DesktopError)

  expect(() => parseRecordCurrentMany([first, { ...first, note: 'Different fact' }])).toThrow(
    DesktopError,
  )
})
