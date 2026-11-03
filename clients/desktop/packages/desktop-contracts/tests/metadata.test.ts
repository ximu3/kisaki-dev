/** @fileoverview Checks metadata completeness, original evidence, field restrictions and independent replacement coverage. */

import { expect, test } from 'vitest'
import { mergeIdentificationClues, selectMetadataFieldValue } from '../src/metadata/fields'
import { parseMetadataCandidate, parseMetadataReadResult } from '../src/metadata/graph'
import { parseMetadataProfileDefinition } from '../src/metadata/profiles'
import { parseFieldProcessingInput, parseFieldProcessingResult } from '../src/metadata/processors'
import { parseMetadataReadRequest, requireMetadataRequestSupport } from '../src/metadata/requests'
import { combineMetadataRelationScope, parseMetadataRelationScope } from '../src/metadata/relations'
import {
  parseMetadataProviderCapabilities,
  validateMetadataProvider,
} from '../src/metadata/providers'

test('field answers preserve unanswered, explicit empty, false and zero meanings', () => {
  expect(
    selectMetadataFieldValue(
      { object: 'entry', entryType: 'anime', field: 'declaredDurationMs' },
      [undefined, null, 0, 10],
      'first',
    ),
  ).toBeNull()
  expect(
    selectMetadataFieldValue(
      { object: 'entry', entryType: 'anime', field: 'declaredDurationMs' },
      [undefined, null, 0, 10],
      'firstNonEmpty',
    ),
  ).toBe(0)
  expect(
    selectMetadataFieldValue(
      { object: 'entry', entryType: 'anime', field: 'isNsfw' },
      [false, true],
      'firstNonEmpty',
    ),
  ).toBe(false)
  expect(
    selectMetadataFieldValue(
      { object: 'entry', entryType: 'game', field: 'aliases' },
      [undefined, []],
      'union',
    ),
  ).toEqual([])
  expect(
    selectMetadataFieldValue(
      { object: 'entry', entryType: 'game', field: 'aliases' },
      [undefined],
      'union',
    ),
  ).toBeUndefined()
  expect(
    selectMetadataFieldValue(
      { object: 'entry', entryType: 'game', field: 'aliases' },
      [[' A '], ['a', 'A B']],
      'union',
    ),
  ).toEqual([' A ', 'A B'])
})

test('confirmed clue merge preserves whole date precision and exact source identity', () => {
  expect(
    mergeIdentificationClues('game', [
      {
        name: 'First',
        releaseDate: { year: 0 },
        externalIdentities: [{ source: 'example', sourceId: 'work/A' }],
      },
      {
        name: 'Second',
        releaseDate: { year: 0, month: 2, day: 29 },
        externalIdentities: [
          { source: 'example', sourceId: 'work/A' },
          { source: 'example', sourceId: 'work/a' },
        ],
      },
    ]),
  ).toEqual({
    name: 'First',
    releaseDate: { year: 0 },
    externalIdentities: [
      { source: 'example', sourceId: 'work/A' },
      { source: 'example', sourceId: 'work/a' },
    ],
  })
})

test('profiles permit partial capability but reject local fields, scalar union and unselected implementations', () => {
  const definition = {
    providers: ['example:metadata'],
    matching: {},
    fields: {
      parts: {
        episode: { description: { providers: ['example:metadata'], selection: 'firstNonEmpty' } },
      },
    },
    relations: {},
  }
  expect(parseMetadataProfileDefinition('anime', definition)).toEqual(definition)
  expect(() => parseMetadataProfileDefinition('game', definition)).toThrow()
  expect(() =>
    parseMetadataProfileDefinition('anime', {
      ...definition,
      fields: { entry: { name: { providers: ['example:metadata'], selection: 'union' } } },
    }),
  ).toThrow()
  expect(() =>
    parseMetadataProfileDefinition('anime', {
      ...definition,
      fields: { entry: { rating: { providers: ['example:metadata'], selection: 'first' } } },
    }),
  ).toThrow()
  expect(() => parseMetadataProfileDefinition('anime', { ...definition, providers: [] })).toThrow()
  expect(() => parseMetadataProfileDefinition('anime', { ...definition, fields: {} })).toThrow()
})

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

test('read requests never silently lose unsupported fields or expand relation membership', () => {
  const request = parseMetadataReadRequest('anime', {
    objects: {
      parts: {
        episode: { fields: ['description'], refs: [{ source: 'example', sourceId: 'episode/1' }] },
      },
    },
  })
  expect(
    parseMetadataReadResult(
      'anime',
      {
        objects: {
          parts: {
            episode: [
              {
                key: 'e',
                identity: { source: 'example', sourceId: 'episode/1' },
                description: 'Text',
              },
            ],
          },
        },
      },
      request,
    ),
  ).toBeDefined()
  expect(() =>
    parseMetadataReadResult(
      'anime',
      {
        objects: {
          parts: {
            episode: [
              {
                key: 'e',
                identity: { source: 'example', sourceId: 'episode/2' },
                description: 'Unrequested',
              },
            ],
          },
        },
      },
      request,
    ),
  ).toThrow()
  expect(() =>
    requireMetadataRequestSupport(
      'anime',
      { objects: { entry: { fields: ['name', 'description'] } } },
      { objects: { entry: { fields: ['name'] } } },
    ),
  ).toThrow()
  expect(() =>
    parseMetadataReadResult('anime', { relations: { workEpisodes: [] } }, request),
  ).toThrow()
})

test('replacement coverage subtracts only affected failed ranges and respects member selection', () => {
  const studio = [{ roles: ['studio'] }] as const
  const publisher = [{ roles: ['publisher'] }] as const
  expect(
    combineMetadataRelationScope(
      'anime',
      'organizationWorks',
      [
        { status: 'answered', empty: false, scope: studio },
        { status: 'unanswered', scope: publisher },
      ],
      'union',
    ),
  ).toEqual([{ workTypes: ['anime'], roles: ['studio'] }])
  expect(
    combineMetadataRelationScope(
      'anime',
      'organizationWorks',
      [
        { status: 'answered', empty: false, scope: studio },
        { status: 'unanswered', scope: studio },
      ],
      'union',
    ),
  ).toBeUndefined()
  expect(
    combineMetadataRelationScope(
      'anime',
      'organizationWorks',
      [{ status: 'answered', empty: true, scope: 'all' }, { status: 'unanswered' }],
      'first',
    ),
  ).toBe('all')
  expect(
    combineMetadataRelationScope(
      'anime',
      'organizationWorks',
      [
        { status: 'answered', empty: true, scope: null },
        { status: 'answered', empty: false, scope: 'all' },
      ],
      'firstNonEmpty',
    ),
  ).toBeUndefined()
  expect(() =>
    parseMetadataRelationScope('novel', 'personWorks', [{ roles: ['voiceActor'] }]),
  ).toThrow()
  expect(() =>
    parseMetadataRelationScope('character', 'personWorks', [{ character: 'none' }]),
  ).toThrow()
})

test('processor results cannot smuggle fields, omit complete items or replace failure with source values', () => {
  const input = parseFieldProcessingInput({
    items: [
      {
        key: 'a',
        field: { object: 'entry', entryType: 'anime', field: 'name' },
        value: 'Original',
      },
      { key: 'b', field: { object: 'entry', entryType: 'anime', field: 'isNsfw' }, value: false },
    ],
  })
  expect(parseFieldProcessingResult(input, { a: 'Processed', b: false })).toEqual({
    a: 'Processed',
    b: false,
  })
  expect(parseFieldProcessingResult(input, { a: 'Processed' }, 'partial')).toEqual({
    a: 'Processed',
  })
  expect(() => parseFieldProcessingResult(input, { a: 'Processed' })).toThrow()
  expect(() => parseFieldProcessingResult(input, { a: 'Processed', b: 'false' })).toThrow()
  expect(() => parseFieldProcessingResult(input, { a: 'Processed', b: false, extra: 0 })).toThrow()
})

test('provider promises and per-context field capability are checked without executing the provider', () => {
  const capabilities = {
    anime: {
      read: {
        objects: {
          entry: { identitySources: ['example'], fields: [] },
          parts: { episode: { fields: ['description'] } },
        },
        relations: { workEpisodes: { fields: [] } },
      },
    },
  } as const
  expect(parseMetadataProviderCapabilities(capabilities, 'en')).toEqual(capabilities)
  expect(() => validateMetadataProvider({ name: 'Example', capabilities }, 'en')).toThrow()
  expect(() =>
    parseMetadataProviderCapabilities(
      {
        person: {
          read: { objects: { entry: { identitySources: ['example'], fields: ['releaseDate'] } } },
        },
      },
      'en',
    ),
  ).toThrow()
})
