/** @fileoverview Exercises platform release selection, immutable history and manifest/reference consistency. */

import { expect, test } from 'vitest'
import { getCompatibilityIssues, targetForPlatform } from '../src/compatibility'
import type { CompatibilityEnvironment } from '../src/compatibility'
import {
  assertCommonMetadata,
  assertManifestMatchesArtifact,
  assertRegistryUpdate,
  getCurrentRelease,
  normalizeRegistry,
  parseRegistry,
  parseSignedRegistry,
  resolveFileReference,
  selectRelease,
} from '../src/registry'
import { artifact, manifest, registry, release } from './support/fixtures'

const host: CompatibilityEnvironment = {
  target: 'windows-x64',
  apiVersion: '1.2.0',
  nodeVersion: '24.11.1',
  electronVersion: '42.0.0',
}

test('flat indexes parse all display, release and artifact fields without resolving relative resources', () => {
  const input = registry([
    release('1.2.0', {
      defaultLocale: 'EN',
      releaseNotes: { EN: '# Changes', 'zh-Hans': '更新' },
      readme: { url: '../readme.md', size: 0, sha256: '0'.repeat(64) },
      artifacts: [
        artifact({
          targets: ['windows-x64', 'linux-x64'],
          license: 'MIT',
          nodeVersionRange: '>=24',
          electronVersionRange: '>=40',
        }),
      ],
    }),
  ])

  const result = parseRegistry(JSON.stringify(input))

  expect(result.extensions[0]?.releases[0]).toMatchObject({
    defaultLocale: 'en',
    releaseNotes: { en: '# Changes' },
    readme: { url: '../readme.md' },
    artifacts: [{ targets: ['linux-x64', 'windows-x64'], license: 'MIT' }],
  })

  expect(
    parseSignedRegistry(JSON.stringify({ ...input, signature: `${'A'.repeat(86)}==` })).signature,
  ).toHaveLength(88)
  expect(() => parseSignedRegistry(JSON.stringify(input))).toThrowError(
    expect.objectContaining({ path: ['signature'] }),
  )

  expect(normalizeRegistry({ ...registry(), extensions: [] }).extensions).toEqual([])

  expect(
    normalizeRegistry(registry([release('1.0.0', { publishedAt: -1 })])).extensions[0]?.releases[0]
      ?.publishedAt,
  ).toBe(-1)
  expect(() =>
    normalizeRegistry(registry([release('1.0.0', { publishedAt: Number.MAX_SAFE_INTEGER })])),
  ).toThrowError(expect.objectContaining({ code: 'invalid-format' }))
})

test('malformed references and empty or ambiguous releases fail with field locations', () => {
  const path: unknown = expect.arrayContaining(['artifacts', 0])
  for (const change of [
    { size: -1 },
    { size: 1.2 },
    { size: Number.MAX_SAFE_INTEGER + 1 },
    { sha256: 'A'.repeat(64) },
    { sha256: `${'a'.repeat(64)}\n` },
    { url: 'https://[broken' },
    { targets: [] },
  ]) {
    expect(() =>
      normalizeRegistry(registry([release('1.0.0', { artifacts: [artifact(change)] })])),
    ).toThrowError(expect.objectContaining({ path }))
  }

  expect(() => normalizeRegistry(registry([release('1.0.0', { artifacts: [] })]))).toThrow(
    'at least one artifact',
  )
  expect(() => normalizeRegistry(registry([]))).toThrow('at least one release')
  expect(() =>
    normalizeRegistry(registry([release('1.0.0', { artifacts: [artifact(), artifact()] })])),
  ).toThrowError(expect.objectContaining({ code: 'target-conflict' }))

  for (const releases of [
    [release(), release()],
    [release('1.0.0+one'), release('1.0.0+two')],
  ]) {
    expect(() => normalizeRegistry(registry(releases))).toThrowError(
      expect.objectContaining({ code: 'version-conflict' }),
    )
  }

  const source = registry()
  expect(() =>
    normalizeRegistry({ ...source, extensions: [...source.extensions, ...source.extensions] }),
  ).toThrow('Duplicate extension ID')
})

test('host matching uses process architecture and reports all actual runtime failures', () => {
  expect(targetForPlatform('win32', 'arm64')).toBe('windows-arm64')
  expect(targetForPlatform('darwin', 'x64')).toBe('macos-x64')
  expect(targetForPlatform('linux', 'x64')).toBe('linux-x64')
  expect(targetForPlatform('win32', 'ia32')).toBeUndefined()

  const conditions = artifact({
    targets: ['linux-x64'],
    apiVersionRange: '^2',
    nodeVersionRange: '>=26',
    electronVersionRange: '>=50',
  })

  expect(getCompatibilityIssues(conditions, host).map((issue) => issue.condition)).toEqual([
    'target',
    'apiVersion',
    'nodeVersion',
    'electronVersion',
  ])

  expect(
    getCompatibilityIssues(artifact({ nodeVersionRange: '*' }), {
      target: 'windows-x64',
      apiVersion: '1.0.0',
    }),
  ).toEqual([{ condition: 'nodeVersion', required: '*', actual: undefined }])

  expect(getCompatibilityIssues(artifact(), { ...host, apiVersion: '1.2.0-beta.1' })).toHaveLength(
    1,
  )
  expect(
    getCompatibilityIssues(artifact({ apiVersionRange: '>=1.2.0-beta.1 <2' }), {
      ...host,
      apiVersion: '1.2.0-beta.2',
    }),
  ).toEqual([])
})

test('selection ignores upload time and ordering while keeping display provenance independent', () => {
  const releases = [
    release('1.0.0', { publishedAt: 1_900_000_000_000 }),
    release('3.0.0-beta.1'),
    release('2.0.0', { artifacts: [artifact({ targets: ['linux-x64'] })] }),
    release('1.5.0'),
  ]
  const extension = normalizeRegistry(registry(releases)).extensions[0]!

  expect(getCurrentRelease(extension.releases)?.version).toBe('2.0.0')
  expect(selectRelease(extension, host)?.release.version).toBe('1.5.0')
  expect(
    selectRelease({ ...extension, releases: [...extension.releases].reverse() }, host)?.release
      .version,
  ).toBe('1.5.0')

  expect(selectRelease(extension, host, { allowPrerelease: true })?.release.version).toBe(
    '3.0.0-beta.1',
  )
  expect(selectRelease(extension, host, { newerThan: '1.5.0' })).toBeUndefined()
  expect(selectRelease(extension, host, { newerThan: '3.0.0' })).toBeUndefined()
  expect(selectRelease(extension, { ...host, target: 'macos-x64' })).toBeUndefined()

  expect(getCurrentRelease([release('2.0.0-beta.1'), release('1.0.0-rc.1')])?.version).toBe(
    '2.0.0-beta.1',
  )
})

test('all targets of a multi-target artifact identify the same exact selection', () => {
  const multi = artifact({ targets: ['windows-x64', 'linux-x64'] })
  const extension = normalizeRegistry(
    registry([
      release('1.0.0', {
        artifacts: [multi, artifact({ targets: ['macos-arm64'], url: 'mac.kisx' })],
      }),
    ]),
  ).extensions[0]!

  const windows = selectRelease(extension, host)!
  const linux = selectRelease(extension, { ...host, target: 'linux-x64' })!

  expect(linux.artifact).toBe(windows.artifact)

  const ambiguous = { ...extension, releases: [release('1.0.0+one'), release('1.0.0+two')] }
  expect(() => selectRelease(ambiguous, host)).toThrowError(
    expect.objectContaining({ code: 'version-conflict' }),
  )
})

test('artifact verification compares package facts, not current listing text', () => {
  expect(() =>
    assertManifestMatchesArtifact(manifest(), 'sample', release(), artifact()),
  ).not.toThrow()

  for (const changed of [
    manifest({ id: 'other' }),
    manifest({ version: '1.0.0+changed' }),
    manifest({ targets: ['linux-x64'] }),
    manifest({ apiVersionRange: '^2' }),
    manifest({ license: 'MIT' }),
  ]) {
    expect(() =>
      assertManifestMatchesArtifact(changed, 'sample', release(), artifact()),
    ).toThrowError(expect.objectContaining({ code: 'artifact-mismatch' }))
  }

  expect(() =>
    assertCommonMetadata([
      manifest(),
      manifest({ targets: ['linux-x64'], license: 'GPL-3.0-only' }),
    ]),
  ).not.toThrow()
  expect(() => assertCommonMetadata([manifest(), manifest({ name: 'Different' })])).toThrowError(
    expect.objectContaining({ code: 'artifact-mismatch' }),
  )
})

test('retained releases keep bytes, target coverage and original publication facts', () => {
  const original = registry()
  for (const changed of [
    artifact({ sha256: 'b'.repeat(64) }),
    artifact({ size: 101 }),
    artifact({ targets: ['windows-x64', 'linux-x64'] }),
    artifact({ nodeVersionRange: '>=24' }),
    artifact({ license: 'MIT' }),
  ]) {
    expect(() =>
      assertRegistryUpdate(original, registry([release('1.0.0', { artifacts: [changed] })])),
    ).toThrowError(expect.objectContaining({ code: 'immutable-release' }))
  }

  for (const changed of [
    release('1.0.0+new'),
    release('1.0.0', { publishedAt: 1 }),
    release('1.0.0', { defaultLocale: 'fr' }),
  ]) {
    expect(() => assertRegistryUpdate(original, registry([changed]))).toThrowError(
      expect.objectContaining({ code: 'immutable-release' }),
    )
  }

  const corrected = registry([
    release('1.0.0', {
      releaseNotes: 'Corrected notes',
      artifacts: [artifact({ url: 'https://cdn.example.org/sample.kisx' })],
    }),
    release('2.0.0', { artifacts: [artifact({ targets: ['linux-arm64'] })] }),
  ])

  expect(() => assertRegistryUpdate(original, corrected)).not.toThrow()
  expect(() => assertRegistryUpdate(original, { ...original, extensions: [] })).not.toThrow()
  expect(() => assertRegistryUpdate(original, registry([release('2.0.0')]))).not.toThrow()
})

test('every nested reference uses the final index response URL and retains its digest', () => {
  const reference = { url: '../assets/icon.png', size: 3, sha256: 'a'.repeat(64) }
  expect(
    resolveFileReference(reference, 'https://cdn.example.org/registry/nested/index.json'),
  ).toEqual({ ...reference, url: 'https://cdn.example.org/registry/assets/icon.png' })
  expect(reference.url).toBe('../assets/icon.png')

  const spaced = parseRegistry(
    JSON.stringify(
      registry([release('1.0.0', { artifacts: [artifact({ url: './my package.kisx' })] })]),
    ),
  ).extensions[0]!.releases[0]!.artifacts[0]!

  expect(spaced.url).toBe('./my package.kisx')
  expect(resolveFileReference(spaced, 'https://example.org/index.json').url).toBe(
    'https://example.org/my%20package.kisx',
  )

  expect(
    resolveFileReference(
      { ...reference, url: 'https://files.example.org/readme.md' },
      'https://cdn.example.org/index.json',
    ).url,
  ).toBe('https://files.example.org/readme.md')
  expect(() => resolveFileReference(reference, 'not a URL')).toThrowError(
    expect.objectContaining({ code: 'invalid-format' }),
  )
})
