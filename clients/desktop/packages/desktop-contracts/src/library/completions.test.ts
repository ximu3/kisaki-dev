import { expect, test } from 'vite-plus/test'
import {
  parseCompletionCreate,
  parseCompletionCreateMany,
  parseCompletionInitialization,
  parseCompletionUpdate,
} from './completions'
import { DesktopError } from '../errors'

test('keeps count-only history separate from dated or annotated completions', () => {
  const note = { completedDate: null, note: '  Finished the alternate ending  ' }
  expect(parseCompletionInitialization({ additionalCompletionCount: 2, records: [note] })).toEqual({
    additionalCompletionCount: 2,
    records: [note],
  })
  expect(() => parseCompletionCreate({ completedDate: null, note: '  ' })).toThrow(DesktopError)
  expect(() => parseCompletionUpdate({ changes: { completedDate: null, note: null } })).toThrow(
    DesktopError,
  )
  expect(parseCompletionUpdate({ changes: { completedDate: null } }).changes).toEqual({
    completedDate: null,
  })
  expect(() =>
    parseCompletionInitialization({
      additionalCompletionCount: Number.MAX_SAFE_INTEGER,
      records: [note],
    }),
  ).toThrow(DesktopError)
})

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
