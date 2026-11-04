/** @fileoverview Verifies safe failures preserve unknown categories and only valid partial business results. */

import { expect, test } from 'vitest'
import { DesktopError, parseExecutionFailure } from './errors'
import { parsePlaybackSettingResult } from './sessions'

test('retains a legal partial result without accepting an incomplete replacement', () => {
  const partialResult = {
    sessionId: 's',
    animeId: 'a',
    fileId: 'f',
    outcome: 'saved',
    saved: { field: 'muted', scope: 'application', value: false },
  }

  const failure = parseExecutionFailure(
    { code: 'UnrecognizedRemoteCode', message: 'Saved but not applied', partialResult },
    parsePlaybackSettingResult,
  )

  expect(failure.code).toBe('UnrecognizedRemoteCode')
  expect(failure.partialResult).toEqual(partialResult)
  expect(() =>
    parseExecutionFailure(
      { code: 'Cancelled', message: 'Cancelled', partialResult: {} },
      parsePlaybackSettingResult,
    ),
  ).toThrow(DesktopError)
})
