/** @fileoverview Checks immutable package identities, paths, categories, and runtime conditions. */

import { expect, it } from 'vitest'
import { parseExtensionId, parsePackagePath } from './identity'
import { parseExtensionManifest, validateExtensionManifest } from './manifest'
import { checkExtensionCompatibility } from './compatibility'

const manifest = {
  schemaVersion: 1,
  id: 'author.tool',
  version: '1.0.0',
  apiVersionRange: '^1.0.0',
  targets: ['windows-x64'],
  entry: 'index.js',
  defaultLocale: 'en',
  name: 'Tool',
}

it.each(['tool', 'author.my-tool', 'a', 'a1.b2'])('accepts formal identity %s', (id) => {
  expect(parseExtensionId(id)).toBe(id)
})

it.each(['Tool', '0tool', 'tool-', 'a..b', 'a/b', 'a:b', '.a'])('rejects identity %s', (id) => {
  expect(() => parseExtensionId(id)).toThrow()
})

it.each([
  '/root.js',
  '../entry.js',
  'a/../entry.js',
  'a\\entry.js',
  'C:/entry.js',
  'a//b',
  './index.js',
])('rejects nonrelative package path %s', (path) => {
  expect(() => parsePackagePath(path)).toThrow()
})

it('keeps unknown readable categories but refuses writing them or ambiguous targets', () => {
  expect(parseExtensionManifest({ ...manifest, categories: ['future'] }).categories).toEqual([
    'future',
  ])
  expect(() => validateExtensionManifest({ ...manifest, categories: ['future'] })).toThrow()
  expect(() =>
    parseExtensionManifest({ ...manifest, targets: ['windows-x64', 'windows-x64'] }),
  ).toThrow()
  expect(() => parseExtensionManifest({ ...manifest, description: undefined })).toThrow()
  expect(() => parseExtensionManifest({ ...manifest, version: 'v1.0.0' })).toThrow()
})

it('preserves valid build metadata while rejecting noncanonical prefixes and whitespace', () => {
  for (const version of ['1.2.3+build.4', '1.2.3-alpha.1+Build']) {
    expect(parseExtensionManifest({ ...manifest, version }).version).toBe(version)
  }
  for (const version of ['v1.2.3+build', '1.2.3+build ', ' 1.2.3', '1.2.3+']) {
    expect(() => parseExtensionManifest({ ...manifest, version })).toThrow()
  }
})

it('reports actual compatibility constraints without inferring capability from metadata', () => {
  const parsed = parseExtensionManifest({
    ...manifest,
    nodeVersionRange: '>=24',
    electronVersionRange: '>=45',
  })
  expect(
    checkExtensionCompatibility(parsed, {
      target: 'windows-x64',
      apiVersion: '1.2.0',
      nodeVersion: '24.11.1',
      electronVersion: '45.0.0',
    }),
  ).toEqual({ status: 'compatible' })
  expect(
    checkExtensionCompatibility(parsed, {
      target: 'linux-arm64',
      apiVersion: '2.0.0',
      nodeVersion: '22.0.0',
    }),
  ).toMatchObject({
    status: 'incompatible',
    issues: [
      { condition: 'target' },
      { condition: 'api' },
      { condition: 'node' },
      { condition: 'electron' },
    ],
  })
})
