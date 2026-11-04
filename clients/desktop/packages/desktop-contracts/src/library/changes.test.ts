/** @fileoverview Verifies changes behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { parseLibraryChange } from './changes'
import { DesktopError } from '../errors'

test('library facts carry only applicable identity context and preserve kind-correction identity', () => {
  expect(
    parseLibraryChange({
      type: 'partKindChanged',
      fromPart: { type: 'animeEpisode', id: 'content' },
      toPart: { type: 'animeExtra', id: 'content' },
      work: { type: 'anime', id: 'a' },
    }).type,
  ).toBe('partKindChanged')

  expect(() =>
    parseLibraryChange({
      type: 'partKindChanged',
      fromPart: { type: 'animeEpisode', id: 'old' },
      toPart: { type: 'animeExtra', id: 'new' },
      work: { type: 'anime', id: 'a' },
    }),
  ).toThrow(DesktopError)

  expect(() =>
    parseLibraryChange({
      type: 'annotationDeleted',
      annotationId: 'annotation',
      work: { type: 'game', id: 'g' },
      fileId: null,
    }),
  ).toThrow(DesktopError)

  expect(() =>
    parseLibraryChange({
      type: 'entryDeleted',
      snapshot: {
        ref: { type: 'game', id: 'g' },
        name: 'Game',
        externalIdentities: [],
        description: 'Private body',
      },
    }),
  ).toThrow(DesktopError)
})
