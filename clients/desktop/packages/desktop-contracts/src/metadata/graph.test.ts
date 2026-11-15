/** @fileoverview Verifies source responses and composed candidates preserve their distinct graph contracts. */

import { test, expect } from 'vite-plus/test'

import { parseMetadataReadResult } from './responses'
import { parseMetadataCandidate } from './candidates'

test('source reads and composed candidates have distinct closed node shapes', () => {
  const source = {
    objects: {
      entry: { key: 'work', name: 'Original' },
      parts: { episode: [{ key: 'ep', numberLabel: '1' }] },
    },
    relations: { workEpisodes: [{ work: 'work', episode: 'ep' }] },
  }

  expect(parseMetadataReadResult('anime', source)).toEqual(source)

  const candidate = {
    entryType: 'anime',
    objects: {
      entry: { key: 'work', identification: { name: 'Original' }, fields: { name: 'Processed' } },
      parts: { episode: [{ key: 'ep', identification: { numberLabel: '1' }, fields: {} }] },
    },
    relations: { workEpisodes: [{ work: 'work', episode: 'ep' }] },
  }

  expect(parseMetadataCandidate(candidate)).toEqual(candidate)

  expect(() =>
    parseMetadataReadResult('anime', { objects: { entry: candidate.objects.entry } }),
  ).toThrow()

  expect(() =>
    parseMetadataCandidate({
      ...candidate,
      objects: { entry: { ...candidate.objects.entry, fields: { record: { status: 'active' } } } },
    }),
  ).toThrow()

  expect(() =>
    parseMetadataCandidate({
      ...candidate,
      relations: { workEpisodes: [{ work: 'work', episode: 'missing' }] },
    }),
  ).toThrow()
})
