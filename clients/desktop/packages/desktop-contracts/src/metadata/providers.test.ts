/** @fileoverview Verifies declared provider methods and per-context field capabilities without executing them. */

import { test, expect } from 'vite-plus/test'

import { parseMetadataProviderCapabilities, validateMetadataProvider } from './providers'

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
