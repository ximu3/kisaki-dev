/** @fileoverview Verifies metadata read requests preserve field scope and independently requested relations. */

import { test, expect } from 'vitest'
import { parseMetadataReadRequest, requireMetadataRequestSupport } from './requests'

import { parseMetadataReadResult } from './responses'

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
