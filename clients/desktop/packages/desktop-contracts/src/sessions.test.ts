/** @fileoverview Verifies api behavior using isolated synthetic inputs. */

import { test, expect, describe, it } from 'vitest'

import { parseNativeEventPayload } from './events'
import {
  parseSessionEnded,
  parseWorkSession,
  parseSessionInteraction,
  parseAnimeOpenInput,
  parseComicOpenInput,
  parseFileSwitchResult,
  parsePlaybackSettingResult,
  parseRecordingRetryResult,
} from './sessions'
import { DesktopError } from './errors'

import { parse as parseLink } from './deeplink'

test('session lifecycle facts retain actual launch snapshots and distinguish detach from failed final recording', () => {
  const context = {
    sessionId: 's',
    gameId: 'g',
    launchConfigId: 'config',
    startedAt: 1,
    saveSource: {
      type: 'snapshot',
      launchConfigId: 'config',
      launchConfigName: 'Launch',
      path: '/fixture/save',
    },
  }

  expect(parseNativeEventPayload('sessions.game.sessionStarted', context)).toEqual(context)

  expect(parseSessionEnded('game', { ...context, endedAt: 2, reason: 'detached' }).reason).toBe(
    'detached',
  )

  expect(() =>
    parseSessionEnded('game', {
      ...context,
      endedAt: 2,
      reason: 'detached',
      recordingError: { code: 'WriteFailed', message: 'Not saved' },
    }),
  ).toThrow(DesktopError)

  expect(() => parseSessionEnded('game', { ...context, endedAt: 2, reason: 'replaced' })).toThrow(
    DesktopError,
  )

  expect(() =>
    parseWorkSession({
      ...context,
      type: 'game',
      timing: { paused: true, counting: true, elapsedMs: 1, graceEndsAt: null },
      monitoring: { available: true, foreground: true },
    }),
  ).toThrow(DesktopError)

  expect(() =>
    parseNativeEventPayload('sessions.game.sessionStarted', {
      ...context,
      saveSource: { ...context.saveSource, launchConfigId: 'other' },
    }),
  ).toThrow(DesktopError)
})

describe('actual session targets and partial outcomes', () => {
  it('defaults local interaction to fail and accepts only an explicit operation policy', () => {
    expect(parseSessionInteraction()).toBe('fail')
    expect(parseSessionInteraction('prompt')).toBe('prompt')
    expect(() => parseSessionInteraction(true)).toThrow(DesktopError)

    expect(() => parseAnimeOpenInput({ animeId: 'a', interaction: 'prompt' })).toThrow(DesktopError)
    expect(() => parseLink('kisaki://open/game/local/g?interaction=prompt')).toThrow(DesktopError)
  })

  it('requires a concrete file for start and applies all medium selectors together', () => {
    expect(() => parseAnimeOpenInput({ animeId: 'a', position: 'start' })).toThrow(DesktopError)

    expect(() =>
      parseAnimeOpenInput({ animeId: 'a', fileId: 'f', episodeId: 'e', extraId: 'x' }),
    ).toThrow(DesktopError)

    expect(parseAnimeOpenInput({ animeId: 'a', fileId: 'f', position: 'start' })).toEqual({
      animeId: 'a',
      fileId: 'f',
      position: 'start',
    })

    expect(parseComicOpenInput({ comicId: 'c', volumeId: 'v', chapterId: 'h' })).toEqual({
      comicId: 'c',
      volumeId: 'v',
      chapterId: 'h',
    })
  })

  it('preserves an ended previous file and only reports a saved setting with the actual committed value', () => {
    expect(
      parseFileSwitchResult('anime', {
        outcome: 'previousEnded',
        previousSessionId: 'old',
        targetFileId: 'new',
      }),
    ).toEqual({ outcome: 'previousEnded', previousSessionId: 'old', targetFileId: 'new' })

    expect(
      parsePlaybackSettingResult({
        sessionId: 's',
        animeId: 'a',
        fileId: 'f',
        outcome: 'saved',
        saved: { field: 'subtitleScale', scope: 'work', value: 1.25 },
      }).outcome,
    ).toBe('saved')

    expect(() =>
      parsePlaybackSettingResult({
        sessionId: 's',
        animeId: 'a',
        fileId: 'f',
        outcome: 'saved',
        saved: null,
      }),
    ).toThrow(DesktopError)

    expect(() =>
      parseRecordingRetryResult({
        sessionId: 's',
        savedActivityIds: ['a'],
        remainingActivityIds: ['a'],
        positionSaved: false,
        positionPending: false,
        issues: [],
      }),
    ).toThrow(DesktopError)
  })
})
