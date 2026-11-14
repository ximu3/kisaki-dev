/** @fileoverview Verifies metadata profiles select valid fields, rules and declared participants. */

import { test, expect } from 'vite-plus/test'

import { parseMetadataProfileDefinition } from './profiles'

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
