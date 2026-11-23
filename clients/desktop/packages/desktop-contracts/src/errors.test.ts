import { expect, test } from 'vite-plus/test'
import { DesktopError, parseExecutionFailure } from './errors'
import { parsePlaybackSettingResult } from './sessions/playback'

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
