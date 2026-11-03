/** @fileoverview Checks type-dependent entry fields and the precise scope of ordinary edit baselines. */

import { expect, test } from 'vitest'
import {
  parseEntryCreate,
  parseEntryTagChange,
  parseEntryUpdate,
  parseExternalIdentities,
} from '../src/library/catalog'

test('creates all entry kinds without inventing work state or catalog facts', () => {
  for (const type of ['game', 'anime', 'comic', 'novel', 'character', 'person', 'organization']) {
    expect(parseEntryCreate({ type, name: 'Synthetic entry' })).toEqual({
      type,
      name: 'Synthetic entry',
    })
  }

  expect(
    parseEntryCreate({
      type: 'anime',
      name: 'Film',
      declaredRegularEpisodeCount: 0,
      record: { status: null },
    }),
  ).toMatchObject({ declaredRegularEpisodeCount: 0 })

  expect(() =>
    parseEntryCreate({ type: 'person', name: 'Person', record: { status: 'planned' } }),
  ).toThrow()

  expect(() => parseEntryCreate({ type: 'novel', name: 'Book', declaredChapterCount: 3 })).toThrow()

  expect(() => parseEntryCreate({ type: 'game', name: 'Game', completionCount: 3 })).toThrow()

  expect(() => parseEntryCreate({ type: 'game', name: 'Game', rating: 50 })).toThrow()
})

test('compares only submitted independent fields and whole replacements', () => {
  const ref = { type: 'game', id: 'g1' }

  expect(
    parseEntryUpdate({
      ref,
      changes: { evaluation: { rating: 0 } },
      expected: { evaluation: { rating: null } },
    }),
  ).toMatchObject({ expected: { evaluation: { rating: null } } })

  expect(() =>
    parseEntryUpdate({ ref, changes: { name: 'B' }, expected: { originalName: 'A' } }),
  ).toThrow()

  expect(() =>
    parseEntryUpdate({
      ref,
      changes: { evaluation: { rating: 40 } },
      expected: { evaluation: { favorite: false } },
    }),
  ).toThrow()

  expect(() =>
    parseEntryUpdate({
      ref,
      changes: { record: { status: 'active' } },
      expected: { record: { additionalDurationMs: 0 } },
    }),
  ).toThrow()

  expect(() => parseEntryUpdate({ ref, changes: { name: undefined } })).toThrow()

  expect(() =>
    parseEntryUpdate({
      ref,
      changes: { tags: { type: 'modify', add: [{ tagId: 't1' }] } },
      expected: { tags: [] },
    }),
  ).toThrow()

  expect(
    parseEntryUpdate({
      ref,
      changes: { tags: { type: 'replace', items: [] } },
      expected: { tags: [{ tagId: 't1', note: null, isSpoiler: true }] },
    }),
  ).toMatchObject({ changes: { tags: { type: 'replace', items: [] } } })
})

test('preserves complete source identities and rejects conflicting membership intent', () => {
  const identities = [
    { source: 'example', sourceId: 'tv/100/season/2' },
    { source: 'example', sourceId: 'tv/100/season/3' },
  ]

  expect(parseExternalIdentities(identities)).toEqual(identities)

  expect(() => parseExternalIdentities([identities[0], identities[0]])).toThrow()

  expect(() => parseEntryTagChange({ type: 'modify' })).toThrow()

  expect(() =>
    parseEntryTagChange({ type: 'modify', add: [{ tagId: 'a' }], remove: ['a'] }),
  ).toThrow()

  expect(() =>
    parseEntryTagChange({ type: 'replace', items: [{ tagId: 'a' }, { tagId: 'a' }] }),
  ).toThrow()
})
