/** @fileoverview Verifies development behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import {
  parseDevelopmentAdoptionResult,
  parseDevelopmentReady,
  parseDevelopmentBuild,
} from './development'
import { DesktopError } from './errors'

test('development receipts identify actual requested builds and preserve interrupted unknowns', () => {
  const builds = [
    { extensionId: 'example.ext', buildId: 1 },
    { extensionId: 'second.ext', buildId: 2 },
  ]
  const partial = {
    outcome: 'interrupted',
    error: { code: 'Cancelled', message: 'Cancelled' },
    builds: [{ ...builds[0], outcome: 'adopted' }],
    activations: [],
  }

  expect(parseDevelopmentAdoptionResult(partial, builds)).toEqual(partial)

  expect(() =>
    parseDevelopmentAdoptionResult(
      { outcome: 'completed', builds: partial.builds, activations: [] },
      builds,
    ),
  ).toThrow(DesktopError)

  expect(() =>
    parseDevelopmentAdoptionResult(
      { ...partial, builds: [{ extensionId: 'example.ext', buildId: 2, outcome: 'adopted' }] },
      builds,
    ),
  ).toThrow(DesktopError)

  expect(
    parseDevelopmentReady({ appVersion: '0.1.0-dev.0', apiVersion: null, buildId: 'app-build' })
      .apiVersion,
  ).toBeNull()

  expect(() =>
    parseDevelopmentBuild({
      extensionId: 'example.ext',
      buildId: 1,
      rootPath: '/fixture/build',
      webviews: [
        { document: { root: 'ui', entry: 'index.html' }, url: 'https://example.test/index.html' },
      ],
    }),
  ).toThrow(DesktopError)

  expect(
    parseDevelopmentBuild({
      extensionId: 'example.ext',
      buildId: 1,
      rootPath: '/fixture/build',
      webviews: [
        { document: { root: 'ui', entry: 'index.html' }, url: 'http://127.0.0.1:12345/index.html' },
      ],
    }).buildId,
  ).toBe(1)
})
