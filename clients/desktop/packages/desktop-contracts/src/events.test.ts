/** @fileoverview Verifies events behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { parseExtensionEventRef, extensionEvent, parseExtensionEventPayload } from './events'
import { DesktopError, parseExecutionFailure } from './errors'

import { parsePlaybackSettingResult } from './sessions'

test('extension events bind their finite reference and parser, while safe failures retain legal partial results', () => {
  expect(() => parseExtensionEventRef('app.ready')).toThrow(DesktopError)
  expect(() => parseExtensionEventRef('example:local:extra')).toThrow(DesktopError)

  const contract = extensionEvent('example.ext:changed', (value) => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
      throw new TypeError('Expected an integer')
    }
    return value
  })

  expect(parseExtensionEventPayload(contract, 3)).toBe(3)
  expect(() => parseExtensionEventPayload(contract, '3')).toThrow(TypeError)

  const partialResult = {
    sessionId: 's',
    animeId: 'a',
    fileId: 'f',
    outcome: 'saved',
    saved: { field: 'muted', scope: 'application', value: false },
  }

  expect(
    parseExecutionFailure(
      { code: 'UnrecognizedRemoteCode', message: 'Saved but not applied', partialResult },
      parsePlaybackSettingResult,
    ).partialResult,
  ).toEqual(partialResult)

  expect(() =>
    parseExecutionFailure(
      { code: 'Cancelled', message: 'Cancelled', partialResult: {} },
      parsePlaybackSettingResult,
    ),
  ).toThrow(DesktopError)
})
