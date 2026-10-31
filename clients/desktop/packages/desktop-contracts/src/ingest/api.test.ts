/** @fileoverview Checks finite adoption authority and separation of initial records from source candidates. */

import { describe, expect, it } from 'vitest'
import { parseIngestAddInput, parseIngestRelations, parseIngestUpdateInput } from './api'

describe('local metadata adoption', () => {
  it('accepts explicit new-work personal values without placing them inside metadata', () => {
    expect(
      parseIngestAddInput({
        entryType: 'game',
        metadata: { type: 'profile', profileId: 'profile', clues: { name: 'Work' } },
        initial: { evaluation: { rating: 0 }, record: { status: 'planned' } },
        localContent: { type: 'directory', path: '/games/work' },
      }),
    ).toMatchObject({ initial: { evaluation: { rating: 0 } } })
    expect(() =>
      parseIngestAddInput({
        entryType: 'person',
        metadata: { type: 'profile', profileId: 'p', clues: {} },
        initial: { record: { status: 'active' } },
      }),
    ).toThrow()
    expect(() =>
      parseIngestAddInput({
        entryType: 'novel',
        metadata: { type: 'profile', profileId: 'p', clues: {} },
        localContent: { type: 'file', path: '/book.epub', recognitionProfileId: 'rules' },
      }),
    ).toThrow()
  })

  it('bounds fields and relations by the exact fixed entry or part kind', () => {
    const metadata = { type: 'profile', profileId: 'p' }
    expect(
      parseIngestUpdateInput('animeEpisode', { metadata, fields: { type: 'overwrite' } }).fields,
    ).toEqual({ type: 'overwrite' })
    expect(() =>
      parseIngestUpdateInput('person', { metadata, fields: { status: 'overwrite' } }),
    ).toThrow()
    expect(() =>
      parseIngestUpdateInput('animeEpisode', {
        metadata,
        relations: { personWorks: { mode: 'append' } },
      }),
    ).toThrow()
    expect(() => parseIngestRelations('anime', { workEpisodes: { mode: 'replace' } })).toThrow()
    expect(() => parseIngestRelations('person', { workRelations: { mode: 'append' } })).toThrow()
  })

  it('intersects selected characters with role and root scope instead of granting a wider relation range', () => {
    expect(
      parseIngestRelations('anime', {
        personWorks: {
          mode: 'replace',
          scope: [{ characters: [{ type: 'character', id: 'c' }], roles: ['voiceActor'] }],
        },
      }).personWorks?.mode,
    ).toBe('replace')
    expect(() =>
      parseIngestRelations('anime', {
        personWorks: {
          mode: 'replace',
          scope: [{ characters: [{ type: 'character', id: 'c' }], roles: ['director'] }],
        },
      }),
    ).toThrow()
    expect(() =>
      parseIngestRelations('character', {
        personWorks: { mode: 'append', scope: [{ characters: [null] }] },
      }),
    ).toThrow()
    expect(() =>
      parseIngestRelations('anime', { personWorks: { mode: 'append', scope: undefined } }),
    ).toThrow()
  })
})
