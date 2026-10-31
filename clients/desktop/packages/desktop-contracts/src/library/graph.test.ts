/** @fileoverview Exercises atomic graph inputs through real catalog values and cross-node addressing. */

import { describe, expect, it } from 'vitest'
import { parseLibraryWriteGraph, type LibraryWriteGraph } from './graph'

const graph: LibraryWriteGraph = {
  entries: {
    create: [
      { key: 'anime', type: 'anime', name: 'Synthetic work', tags: [{ tagId: { key: 'tag' } }] },
      { key: 'person', type: 'person', name: 'Synthetic person' },
      { key: 'character', type: 'character', name: 'Synthetic character' },
    ],
  },
  parts: {
    create: [
      {
        key: 'episode',
        type: 'animeEpisode',
        work: { key: 'anime' },
        data: { type: 'regular', numberLabel: '1' },
      },
    ],
  },
  tags: { create: [{ key: 'tag', name: 'Synthetic tag' }] },
  relations: {
    workCharacters: {
      add: [{ work: { key: 'anime' }, character: { key: 'character' }, role: 'main' }],
    },
    personWorks: {
      add: [
        {
          work: { key: 'anime' },
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
        work: { key: 'anime' },
        directories: [{ path: '/media/synthetic' }],
        files: [{ path: '/media/synthetic/01.mkv', parts: [{ key: 'episode' }] }],
      },
    ],
  },
}

describe('library write graphs', () => {
  it('accepts an empty atomic intent and a complete work/person/part/tag/local-file graph', () => {
    expect(parseLibraryWriteGraph({})).toEqual({})
    expect(parseLibraryWriteGraph(graph)).toEqual(graph)
  })

  it('validates anime classifications independently of graph part kinds', () => {
    expect(() =>
      parseLibraryWriteGraph({
        parts: {
          create: [
            {
              key: 'p',
              type: 'animeExtra',
              work: { type: 'anime', id: 'a' },
              data: { type: 'regular' },
            },
          ],
        },
      }),
    ).toThrow()
  })

  it('rejects dangling, globally duplicate, and wrong-kind creation keys', () => {
    expect(() => parseLibraryWriteGraph({ ...graph, tags: { create: [] } })).toThrow()
    expect(() =>
      parseLibraryWriteGraph({
        entries: { create: [{ key: 'same', type: 'person', name: 'Person' }] },
        tags: { create: [{ key: 'same', name: 'Tag' }] },
      }),
    ).toThrow()
    expect(() =>
      parseLibraryWriteGraph({
        ...graph,
        relations: {
          personWorks: {
            add: [
              {
                work: { key: 'anime' },
                person: { key: 'character' },
                character: null,
                role: 'director',
              },
            ],
          },
        },
      }),
    ).toThrow()
  })

  it('rejects unknown fields, non-work personal records, and unrelated edit baselines', () => {
    expect(() => parseLibraryWriteGraph({ commands: [] })).toThrow()
    expect(() =>
      parseLibraryWriteGraph({
        entries: {
          create: [{ key: 'p', type: 'person', name: 'Person', record: { status: 'active' } }],
        },
      }),
    ).toThrow()
    expect(() =>
      parseLibraryWriteGraph({
        entries: {
          update: [
            {
              ref: { type: 'game', id: 'g' },
              changes: { name: 'New' },
              expected: { isNsfw: false },
            },
          ],
        },
      }),
    ).toThrow()
  })

  it('rejects contradictory removals and snapshots outside the fixed removal range', () => {
    expect(() =>
      parseLibraryWriteGraph({
        relations: {
          workCharacters: { remove: ['r'], update: [{ id: 'r', changes: { note: 'edited' } }] },
        },
      }),
    ).toThrow()
    expect(() =>
      parseLibraryWriteGraph({
        relations: {
          workCharacters: {
            remove: ['r'],
            expected: [
              {
                id: 'other',
                binding: {
                  work: { type: 'game', id: 'g' },
                  character: { type: 'character', id: 'c' },
                  role: null,
                },
                note: null,
                isSpoiler: false,
              },
            ],
          },
        },
      }),
    ).toThrow()
  })

  it('rejects reversed duplicate work facts and unsupported person duties', () => {
    expect(() =>
      parseLibraryWriteGraph({
        relations: {
          workRelations: {
            add: [
              { from: { type: 'anime', id: 'a' }, to: { type: 'anime', id: 'b' }, type: 'sequel' },
              { from: { type: 'anime', id: 'b' }, to: { type: 'anime', id: 'a' }, type: 'prequel' },
            ],
          },
        },
      }),
    ).toThrow()
    expect(() =>
      parseLibraryWriteGraph({
        entries: {
          create: [
            { key: 'novel', type: 'novel', name: 'Novel' },
            { key: 'person', type: 'person', name: 'Person' },
          ],
        },
        relations: {
          personWorks: {
            add: [
              {
                work: { key: 'novel' },
                person: { key: 'person' },
                character: null,
                role: 'voiceActor',
              },
            ],
          },
        },
      }),
    ).toThrow()
  })

  it('rejects file/part ownership mismatches and double tag writes across graph regions', () => {
    expect(() =>
      parseLibraryWriteGraph({
        ...graph,
        localContent: {
          anime: [
            {
              work: { type: 'anime', id: 'another' },
              files: [{ path: '/media/01.mkv', parts: [{ key: 'episode' }] }],
            },
          ],
        },
      }),
    ).toThrow()
    expect(() =>
      parseLibraryWriteGraph({
        ...graph,
        relations: {
          entryTags: [{ entry: { key: 'anime' }, change: { type: 'replace', items: [] } }],
        },
      }),
    ).toThrow()
  })
})
