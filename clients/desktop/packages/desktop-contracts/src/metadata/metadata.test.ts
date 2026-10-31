/** @fileoverview Exercises source graphs, context-specific fields, scoped coverage, and explicit profile policies. */

import { describe, expect, it } from 'vitest'
import { parseMetadataCandidate } from './candidate'
import { parseMetadataEntryFields } from './fields'
import { matchingName, parsePartMatchingRules } from './matching'
import { parseMetadataProfileDefinition } from './profiles'
import { parseMetadataReadRequest, parseMetadataReadResult } from './providers'
import { parseMetadataRelationScopes } from './relations'

function comicCandidate() {
  return {
    entryType: 'comic',
    objects: {
      entry: {
        key: 'comic',
        identification: { originalName: 'Original' },
        fields: { name: 'Translated', isNsfw: false, declaredPageCount: 0 },
      },
      relatedEntries: {
        person: [{ key: 'author', identification: { name: 'Author' }, fields: { name: 'Author' } }],
      },
      parts: {
        volume: [{ key: 'volume', identification: { numberLabel: '1' }, fields: {} }],
        chapter: [{ key: 'chapter', identification: { numberLabel: '1' }, fields: { name: null } }],
      },
      tags: [{ key: 'tag', name: 'Example' }],
    },
    relations: {
      personWorks: [{ work: 'comic', person: 'author', role: 'creator', character: null }],
      workVolumes: [{ work: 'comic', volume: 'volume' }],
      workChapters: [{ work: 'comic', chapter: 'chapter' }],
      volumeChapters: [{ volume: 'volume', chapter: 'chapter', numberLabel: '1' }],
      entryTags: [{ entry: 'comic', tag: 'tag' }],
    },
    partMatching: {
      volume: [{ fields: ['numberLabel'] }],
      chapter: [{ fields: ['volumeNumberLabel', 'originalName'] }],
    },
  }
}

describe('metadata graph contracts', () => {
  it('keeps original clues separate from adopted fields and preserves actual empty/false/zero values', () => {
    expect(parseMetadataCandidate('comic', comicCandidate())).toEqual(comicCandidate())
    expect(
      parseMetadataEntryFields('character', {
        age: { kind: 'text', value: 'Unknown in story' },
        primaryImage: [],
      }),
    ).toEqual({ age: { kind: 'text', value: 'Unknown in story' }, primaryImage: [] })
    expect(() => parseMetadataEntryFields('person', { rating: 80 })).toThrow()
    expect(() => parseMetadataEntryFields('person', { primaryImageId: 'local' })).toThrow()
    expect(() => parseMetadataEntryFields('person', { name: undefined })).toThrow()
  })

  it('rejects duplicate keys, wrong endpoints, invalid duties, and a different root context', () => {
    const candidate = comicCandidate()
    expect(() =>
      parseMetadataCandidate('comic', {
        ...candidate,
        objects: { ...candidate.objects, tags: [{ key: 'comic', name: 'Tag' }] },
      }),
    ).toThrow()
    expect(() =>
      parseMetadataCandidate('comic', {
        ...candidate,
        relations: {
          personWorks: [{ work: 'comic', person: 'volume', role: 'creator', character: null }],
        },
      }),
    ).toThrow()
    expect(() =>
      parseMetadataCandidate('comic', {
        ...candidate,
        relations: {
          personWorks: [{ work: 'comic', person: 'author', role: 'voiceActor', character: null }],
        },
      }),
    ).toThrow()
    expect(() => parseMetadataCandidate('anime', candidate)).toThrow()
    expect(() =>
      parseMetadataCandidate('game', {
        entryType: 'game',
        objects: { entry: { key: 'root', identification: {}, fields: {} }, parts: {} },
      }),
    ).toThrow()
  })

  it('distinguishes source flat answers, relation membership requests, and explicit empty refs', () => {
    const request = {
      objects: { parts: { episode: { fields: ['name', 'type'], refs: [] } } },
      relations: { workEpisodes: { fields: [] } },
    }
    expect(parseMetadataReadRequest('anime', request)).toEqual(request)
    expect(() => parseMetadataReadRequest('novel', request)).toThrow()
    expect(() =>
      parseMetadataReadRequest('anime', { objects: { entry: { fields: ['sortName'] } } }),
    ).toThrow()
    const result = {
      objects: {
        entry: { key: 'a' },
        parts: { episode: [{ key: 'ep', type: 'special', numberLabel: 'SP1' }] },
      },
      relations: { workEpisodes: [{ work: 'a', episode: 'ep' }] },
    }
    expect(parseMetadataReadResult('anime', result)).toEqual(result)
    expect(() =>
      parseMetadataReadResult('anime', {
        ...result,
        relations: { workEpisodes: [{ work: 'a', episode: 'missing' }] },
      }),
    ).toThrow()
    expect(() =>
      parseMetadataReadResult('anime', { objects: { entry: { key: 'a', fields: {} } } }),
    ).toThrow()
  })

  it('restricts complete scopes to meaningful dimensions in the root context', () => {
    expect(
      parseMetadataRelationScopes('organization', {
        organizationWorks: [{ roles: ['studio'], workTypes: ['anime'] }],
      }),
    ).toEqual({ organizationWorks: [{ roles: ['studio'], workTypes: ['anime'] }] })
    expect(() =>
      parseMetadataRelationScopes('comic', { organizationWorks: [{ roles: ['studio'] }] }),
    ).toThrow()
    expect(() =>
      parseMetadataRelationScopes('character', { personWorks: [{ character: 'none' }] }),
    ).toThrow()
    expect(() =>
      parseMetadataRelationScopes('anime', { workCharacters: [{ workTypes: ['game'] }] }),
    ).toThrow()
    expect(() => parseMetadataRelationScopes('person', { workRelations: 'all' })).toThrow()
    expect(() => parseMetadataRelationScopes('anime', { personWorks: [{}] })).toThrow()
  })

  it('allows only explicit matching fields and preserves punctuation and volume numbers', () => {
    expect(matchingName('  A\u0301 B  VOL. 1 ')).toBe('Á b vol. 1')
    expect(
      parsePartMatchingRules('comic', { chapter: [{ fields: ['volumeNumberLabel'] }] }),
    ).toEqual({ chapter: [{ fields: ['volumeNumberLabel'] }] })
    expect(() =>
      parsePartMatchingRules('anime', { episode: [{ fields: ['volumeNumberLabel'] }] }),
    ).toThrow()
    expect(() =>
      parsePartMatchingRules('novel', { volume: [{ fields: ['numberLabel', 'numberLabel'] }] }),
    ).toThrow()
    expect(() => parsePartMatchingRules('game', {})).toThrow()
  })
})

describe('metadata profiles', () => {
  const scalar = { providers: ['provider'], selection: 'firstNonEmpty' }
  it('accepts image-only and Part-field-only profiles without inventing member lists', () => {
    const profile = {
      providers: ['provider'],
      matching: {},
      fields: { parts: { episode: { name: scalar } } },
      relations: {},
    }
    expect(parseMetadataProfileDefinition('anime', profile)).toEqual(profile)
    expect(
      parseMetadataProfileDefinition('game', {
        ...profile,
        fields: { entry: { iconImage: { ...scalar, selection: 'union' } } },
      }).fields,
    ).toEqual({ entry: { iconImage: { ...scalar, selection: 'union' } } })
  })

  it('rejects mismatched kinds, scalar union, unselected providers, and non-executable empty profiles', () => {
    const profile = {
      providers: ['provider'],
      matching: {},
      fields: { entry: { name: scalar } },
      relations: {},
    }
    expect(() =>
      parseMetadataProfileDefinition('anime', {
        ...profile,
        fields: { entry: { name: { ...scalar, selection: 'union' } } },
      }),
    ).toThrow()
    expect(() =>
      parseMetadataProfileDefinition('anime', { ...profile, providers: ['different'] }),
    ).toThrow()
    expect(() => parseMetadataProfileDefinition('anime', { ...profile, fields: {} })).toThrow()
    expect(() =>
      parseMetadataProfileDefinition('anime', {
        ...profile,
        relations: { workEpisodes: { providers: ['provider'], selection: 'union', fields: {} } },
      }),
    ).toThrow()
    expect(() =>
      parseMetadataProfileDefinition('person', {
        ...profile,
        fields: { entry: { iconImage: scalar } },
      }),
    ).toThrow()
  })
})
