/** @fileoverview Checks package format, normalized values and strict JSON failure locations. */

import { expect, test } from 'vitest'
import { normalizeManifest, parseManifest, parsePackagePath } from './manifest'
import { manifest } from '../tests/support/fixtures'

test('complete manifests normalize locales and targets while preserving free display values', () => {
  const input = manifest({
    defaultLocale: 'EN',
    name: { EN: 'Sample' },
    targets: ['windows-x64', 'linux-arm64'],
    categories: ['metadata', 'future-category'],
    keywords: ['Visual Novel'],
    author: { name: 'Someone', url: 'https://example.org/author' },
    homepage: 'https://example.org',
    repository: 'https://example.org/repository',
    issues: 'https://example.org/issues',
    icon: 'assets/icon.png',
    readme: 'README.md',
    license: 'MIT',
    nodeVersionRange: '>=24',
    electronVersionRange: '>=40',
  })
  const before = structuredClone(input)

  const parsed = parseManifest(JSON.stringify(input))

  expect(parsed).toMatchObject({
    defaultLocale: 'en',
    name: { en: 'Sample' },
    targets: ['linux-arm64', 'windows-x64'],
    categories: ['metadata', 'future-category'],
  })
  expect(input).toEqual(before)

  expect(normalizeManifest(manifest({ categories: [] })).categories).toEqual([])
})

test('required identity, entry, schema and runtime fields reject invalid values at their actual paths', () => {
  const changes = [
    ['schemaVersion', 2],
    ['version', 'v1.0.0'],
    ['version', '1.01.0'],
    ['id', 'Bad'],
    ['targets', []],
    ['targets', new Array<unknown>(1)],
    ['targets', ['windows-x64', 'windows-x64']],
    ['targets', ['android-arm64']],
    ['apiVersionRange', 'tomorrow'],
    ['entry', '../entry.js'],
    ['defaultLocale', 'en_US'],
    ['homepage', 'relative/page'],
    ['homepage', 'https://[invalid'],
  ] as const

  for (const [field, value] of changes) {
    const path: unknown = expect.arrayContaining([field])
    expect(() => normalizeManifest({ ...manifest(), [field]: value })).toThrow(
      expect.objectContaining({ path }),
    )
  }

  for (const field of [
    'schemaVersion',
    'id',
    'version',
    'targets',
    'apiVersionRange',
    'entry',
    'defaultLocale',
    'name',
  ]) {
    const input: Record<string, unknown> = { ...manifest() }
    delete input[field]

    expect(() => normalizeManifest(input)).toThrow()
  }

  expect(normalizeManifest(manifest({ version: '1.2.3-rc.1+linux' })).version).toBe(
    '1.2.3-rc.1+linux',
  )
})

test('paths remain package-relative without pretending to validate a physical archive', () => {
  for (const path of ['node/entry.js', '资料/icon.png', 'assets/100%.png']) {
    expect(parsePackagePath(path)).toBe(path)
  }

  for (const path of [
    '/entry.js',
    '//server/entry.js',
    'C:/entry.js',
    'a\\b',
    './entry.js',
    'a/../entry.js',
    'a//b',
    'a\0b',
    'a/',
  ]) {
    expect(() => parsePackagePath(path)).toThrow()
  }
})

test('strict JSON rejects comments, trailing commas, duplicate decoded names and invalid JCS values', () => {
  for (const json of ['{"id":"a", "\\u0069d":"b"}', '{"unknown":{"x":1,"x":2}}']) {
    expect(() => parseManifest(json)).toThrow(
      expect.objectContaining({ code: 'duplicate-property' }),
    )
  }

  for (const json of [
    '{} garbage',
    '{/* comment */}',
    '{"a":1,}',
    '',
    '{"unknown":1e400}',
    '{"unknown":"\\ud800"}',
  ]) {
    expect(() => parseManifest(json)).toThrow()
  }

  expect(() => normalizeManifest({ ...manifest(), entry: NaN })).toThrow(
    expect.objectContaining({ path: ['entry'] }),
  )
  expect(() => normalizeManifest({ ...manifest(), description: undefined })).toThrow()

  expect(parseManifest(JSON.stringify({ ...manifest(), unknown: { '😀': '🌸' } })).id).toBe(
    'sample',
  )
})
