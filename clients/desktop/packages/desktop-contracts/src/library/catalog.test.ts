/** @fileoverview Verifies kind-specific writes, field baselines, and independent tolerant reads. */

import { expect, it } from 'vitest'
import { parseEntryCreate, parseEntryUpdate, readAliases, readExternalLinks } from './catalog'
import { parsePartCreate, parsePartUpdate } from './parts'
import { normalizeWorkRelation, parseRelationBinding, parseRelationUpdate } from './relations'

it('accepts real personal values only for their applicable entry kinds', () => {
  expect(
    parseEntryCreate({
      type: 'game',
      name: '星屿',
      evaluation: { rating: 0 },
      record: { status: null, additionalDurationMs: 0 },
      completionRecords: [{ completedDate: null, note: null }],
    }),
  ).toMatchObject({ record: { status: null } })
  for (const input of [
    { type: 'person', name: '作者', record: { status: 'active' } },
    { type: 'organization', name: '出版社', completionRecords: [] },
    { type: 'game', name: '作品', releaseStatus: 'ongoing' },
    { type: 'character', name: '角色', age: { kind: 'number', value: -1 } },
    { type: 'game', name: '作品', evaluation: { rating: 100.5 } },
  ]) {
    expect(() => parseEntryCreate(input)).toThrow(expect.objectContaining({ code: 'InvalidInput' }))
  }
})

it('rejects unrelated, unknown, technical, and nested edit baselines', () => {
  expect(
    parseEntryUpdate('game', {
      changes: { name: '新版', evaluation: { favorite: true } },
      expected: { name: '旧版', evaluation: { favorite: false } },
    }),
  ).toMatchObject({ expected: { name: '旧版' } })
  for (const input of [
    { changes: { name: '新版' }, expected: { updatedAt: 1 } },
    { changes: { name: '新版' }, expected: { aliases: [] } },
    { changes: { evaluation: { favorite: true } }, expected: { evaluation: { rating: null } } },
    {
      changes: { record: { status: 'active' } },
      expected: { record: { additionalDurationMs: 0 } },
    },
    { changes: { name: undefined } },
    { changes: { completionCount: 2 } },
    { changes: { type: 'anime' } },
  ]) {
    expect(() => parseEntryUpdate('game', input)).toThrow(
      expect.objectContaining({ code: 'InvalidInput' }),
    )
  }
  expect(() => parseEntryUpdate('person', { changes: { record: { status: null } } })).toThrow()
})

it('distinguishes membership replacement baselines from idempotent modify intents', () => {
  const tag = { tagId: 'tag', note: null, isSpoiler: false }
  expect(
    parseEntryUpdate('comic', {
      changes: { tags: { type: 'replace', items: [tag] } },
      expected: { tags: [] },
    }),
  ).toBeDefined()
  expect(() =>
    parseEntryUpdate('comic', {
      changes: { tags: { type: 'modify', add: [tag] } },
      expected: { tags: [] },
    }),
  ).toThrow()
  expect(() => parseEntryUpdate('comic', { changes: { tags: { type: 'modify' } } })).toThrow()
  expect(() =>
    parseEntryUpdate('comic', {
      changes: { tags: { type: 'modify', add: [tag], remove: ['tag'] } },
    }),
  ).toThrow()
  expect(() =>
    parseEntryUpdate('comic', {
      changes: { tags: { type: 'replace', items: [{ tagId: 'tag' }] } },
    }),
  ).toThrow()
})

it('reads ordinary lists independently but strictly rejects the same invalid write', () => {
  const raw = ['First', 2, 'Second', null]
  expect(readAliases(raw)).toEqual(['First', 'Second'])
  expect(raw).toEqual(['First', 2, 'Second', null])
  expect(readAliases({})).toEqual([])
  expect(
    readExternalLinks([
      { name: 'Site', url: 'https://example.org/' },
      { name: 'bad', url: 'not a url' },
    ]),
  ).toEqual([{ name: 'Site', url: 'https://example.org/' }])
  expect(() => parseEntryUpdate('game', { changes: { aliases: raw } })).toThrow()
})

it('keeps the outer part kind distinct from anime classification and rejects technical updates', () => {
  expect(
    parsePartCreate({
      type: 'animeEpisode',
      work: { type: 'anime', id: 'work' },
      data: { type: null, numberLabel: 'SP 2' },
      completed: true,
    }),
  ).toMatchObject({ data: { type: null } })
  expect(() =>
    parsePartCreate({
      type: 'animeExtra',
      work: { type: 'anime', id: 'work' },
      data: { numberLabel: '1' },
    }),
  ).toThrow()
  expect(() =>
    parsePartCreate({ type: 'comicChapter', work: { type: 'novel', id: 'work' }, data: {} }),
  ).toThrow()
  expect(() => parsePartUpdate('animeEpisode', { changes: { completed: true } })).toThrow()
  expect(() =>
    parsePartUpdate('comicVolume', { changes: { name: 'Volume' }, expected: { sortOrder: 0 } }),
  ).toThrow()
})

it('enforces duty, medium, character scope, and complete relation bindings', () => {
  const work = { type: 'novel', id: 'work' }
  expect(() =>
    parseRelationBinding('personWorks', {
      work,
      person: { type: 'person', id: 'person' },
      character: null,
      role: 'voiceActor',
    }),
  ).toThrow()
  expect(() =>
    parseRelationBinding('personWorks', {
      work,
      person: { type: 'person', id: 'person' },
      character: { type: 'character', id: 'character' },
      role: 'creator',
    }),
  ).toThrow()
  expect(
    parseRelationUpdate('workCharacters', {
      changes: { note: 'updated' },
      expected: {
        binding: { work, character: { type: 'character', id: 'character' }, role: null },
        note: null,
      },
    }),
  ).toBeDefined()
  expect(() =>
    parseRelationUpdate('workCharacters', {
      changes: { note: 'updated' },
      expected: { binding: { work } },
    }),
  ).toThrow()
  expect(() => parseRelationUpdate('workRelations', { changes: { isSpoiler: true } })).toThrow()
})

it('normalizes reverse and symmetric relations without creating a second fact', () => {
  const a = { type: 'game', id: 'a' } as const
  const b = { type: 'game', id: 'b' } as const
  expect(normalizeWorkRelation({ from: b, to: a, type: 'prequel' })).toEqual({
    from: a,
    to: b,
    type: 'sequel',
  })
  expect(normalizeWorkRelation({ from: b, to: a, type: 'related' })).toEqual({
    from: a,
    to: b,
    type: 'related',
  })
  expect(() => normalizeWorkRelation({ from: a, to: a, type: 'related' })).toThrow()
})
