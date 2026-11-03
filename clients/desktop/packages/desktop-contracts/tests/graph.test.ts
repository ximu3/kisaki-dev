/** @fileoverview Validates atomic graph addressing and contradictions using synthetic catalog and local-file inputs. */

import { expect, test } from 'vitest'
import { parseLibraryWriteGraph, parseLibraryWriteResult } from '../src/library/graph'

const graph = {
  entries: {
    create: [
      { key: 'work', type: 'anime', name: 'Synthetic work', tags: [{ tagId: { key: 'tag' } }] },
      { key: 'person', type: 'person', name: 'Synthetic person' },
      { key: 'character', type: 'character', name: 'Synthetic character' },
    ],
  },
  parts: {
    create: [
      {
        key: 'episode',
        type: 'animeEpisode',
        work: { key: 'work' },
        data: { type: 'regular', numberLabel: '1' },
      },
    ],
  },
  tags: { create: [{ key: 'tag', name: 'Synthetic tag' }] },
  relations: {
    workCharacters: {
      add: [{ work: { key: 'work' }, character: { key: 'character' }, role: 'main' }],
    },
    personWorks: {
      add: [
        {
          work: { key: 'work' },
          person: { key: 'person' },
          character: { key: 'character' },
          role: 'voiceActor',
        },
      ],
    },
  },
  localContent: {
    anime: [
      {
        work: { key: 'work' },
        files: [{ path: '/synthetic/episode.mkv', associations: [{ part: { key: 'episode' } }] }],
      },
    ],
  },
}

test('preserves a complete graph with new people, parts, tags and an initial file association', () => {
  expect(parseLibraryWriteGraph(graph)).toEqual(graph)

  expect(parseLibraryWriteGraph({})).toEqual({})
})

test('rejects duplicate cross-region keys, missing keys and wrong-kind endpoints', () => {
  expect(() =>
    parseLibraryWriteGraph({
      ...graph,
      tags: { create: [{ key: 'work', name: 'Duplicate key' }] },
    }),
  ).toThrow()

  expect(() => parseLibraryWriteGraph({ parts: graph.parts })).toThrow()

  expect(() =>
    parseLibraryWriteGraph({
      ...graph,
      relations: {
        personWorks: {
          add: [
            {
              work: { key: 'work' },
              person: { key: 'character' },
              character: null,
              role: 'voiceActor',
            },
          ],
        },
      },
    }),
  ).toThrow()

  expect(() =>
    parseLibraryWriteGraph({
      ...graph,
      entries: {
        create: [{ key: 'work', type: 'person', name: 'Person', record: { status: 'active' } }],
      },
    }),
  ).toThrow()

  expect(() =>
    parseLibraryWriteGraph({
      ...graph,
      localContent: { game: [{ work: { key: 'work' }, files: [] }] },
    }),
  ).toThrow()
})

test('distinguishes a part kind from anime data.type and requires matching known ownership', () => {
  expect(() =>
    parseLibraryWriteGraph({
      ...graph,
      parts: {
        create: [
          {
            key: 'episode',
            type: 'animeEpisode',
            work: { key: 'work' },
            data: { type: 'animeEpisode' },
          },
        ],
      },
    }),
  ).toThrow()

  const wrongOwner = {
    entries: {
      create: [
        { key: 'one', type: 'comic', name: 'One' },
        { key: 'two', type: 'comic', name: 'Two' },
      ],
    },
    parts: {
      create: [
        { key: 'volume', type: 'comicVolume', work: { key: 'one' }, data: {} },
        { key: 'chapter', type: 'comicChapter', work: { key: 'two' }, data: {} },
      ],
    },
    relations: {
      volumeChapters: [
        {
          volume: { key: 'volume' },
          change: { type: 'replace', items: [{ chapter: { key: 'chapter' }, numberLabel: '1' }] },
        },
      ],
    },
  }

  expect(() => parseLibraryWriteGraph(wrongOwner)).toThrow()
})

test('rejects reverse-direction duplicate work facts and contradictory relation edits', () => {
  const a = { type: 'game', id: 'a' }
  const b = { type: 'game', id: 'b' }

  expect(() =>
    parseLibraryWriteGraph({
      relations: {
        workRelations: {
          add: [
            { from: a, to: b, type: 'sequel' },
            { from: b, to: a, type: 'prequel' },
          ],
        },
      },
    }),
  ).toThrow()

  expect(() =>
    parseLibraryWriteGraph({
      relations: {
        workRelations: { update: [{ id: 'r', changes: { note: 'New' } }], remove: ['r'] },
      },
    }),
  ).toThrow()

  expect(() =>
    parseLibraryWriteGraph({
      relations: {
        workRelations: {
          remove: ['r'],
          expected: [{ id: 'other', binding: { from: a, to: b, type: 'sequel' }, note: null }],
        },
      },
    }),
  ).toThrow()
})

test('does not delete a character binding while adding work that depends on it', () => {
  const work = { type: 'anime', id: 'a' }
  const character = { type: 'character', id: 'c' }

  expect(() =>
    parseLibraryWriteGraph({
      relations: {
        workCharacters: {
          remove: ['wc'],
          expected: [
            { id: 'wc', binding: { work, character, role: 'main' }, note: null, isSpoiler: false },
          ],
        },
        personWorks: {
          add: [{ work, character, person: { type: 'person', id: 'p' }, role: 'voiceActor' }],
        },
      },
    }),
  ).toThrow()
})

test('result maps contain only all actual creates with their requested kinds', () => {
  const request = parseLibraryWriteGraph({
    entries: { create: [{ key: 'a', type: 'anime', name: 'A' }] },
  })

  expect(
    parseLibraryWriteResult(
      { entries: { a: { type: 'anime', id: 'actual' } }, parts: {}, tags: {}, changed: true },
      request,
    ),
  ).toMatchObject({ changed: true })

  expect(() =>
    parseLibraryWriteResult({ entries: {}, parts: {}, tags: {}, changed: false }, request),
  ).toThrow()

  expect(() =>
    parseLibraryWriteResult(
      { entries: { a: { type: 'game', id: 'actual' } }, parts: {}, tags: {}, changed: true },
      request,
    ),
  ).toThrow()
})
