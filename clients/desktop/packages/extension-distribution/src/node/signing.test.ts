/** @fileoverview Verifies signed original JSON, pinned trust, duplicate-key rejection, and immutable release selection. */

import { generateKeyPairSync } from 'node:crypto'
import { expect, it } from 'vitest'
import { signRegistry, verifyRegistry } from './signing'
import { parseExtensionRegistry, resolveDistributionFile } from '../registry'
import { selectExtensionRelease } from '../compatibility'

const keys = generateKeyPairSync('ed25519')
const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString()
const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const artifact = {
  targets: ['windows-x64'],
  apiVersionRange: '^1.0.0',
  url: './tool.kisx',
  size: 123,
  sha256: 'a'.repeat(64),
}
const release = { version: '1.0.0', publishedAt: 0, defaultLocale: 'en', artifacts: [artifact] }
const registry = {
  schemaVersion: 1,
  id: 'test',
  publicKey,
  defaultLocale: 'en',
  name: 'Synthetic registry',
  extensions: [{ id: 'tool', defaultLocale: 'en', name: 'Tool', releases: [release] }],
}

it('signs unknown fields and nested signatures while ignoring whitespace and property order', () => {
  const signed = signRegistry(
    JSON.stringify({ ...registry, future: { signature: 'nested', value: 3 } }),
    privateKey,
  )
  expect(verifyRegistry(signed, publicKey).id).toBe('test')
  const object = JSON.parse(signed) as Record<string, unknown>
  expect(
    verifyRegistry(JSON.stringify(Object.fromEntries(Object.entries(object).reverse())), publicKey)
      .id,
  ).toBe('test')
  expect(() => verifyRegistry(signed.replace('nested', 'tampered'), publicKey)).toThrow(
    expect.objectContaining({ code: 'InvalidSignature' }),
  )
  expect(() => verifyRegistry(signed.replace('"value": 3', '"value": 4'), publicKey)).toThrow(
    expect.objectContaining({ code: 'InvalidSignature' }),
  )
})

it('preserves signed future members even when their names match object prototype properties', () => {
  const extra = Object.fromEntries<unknown>([
    ['__proto__', { future: true }],
    ['constructor', 'future'],
  ])
  const signed = signRegistry(JSON.stringify({ ...registry, ...extra }), privateKey)
  const result = verifyRegistry(signed, publicKey)
  expect(Object.hasOwn(result, '__proto__')).toBe(true)
  expect(Object.hasOwn(result, 'constructor')).toBe(true)
  expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
})

it('requires the pinned Ed25519 key and rejects duplicate members before interpretation', () => {
  const signed = signRegistry(JSON.stringify(registry), privateKey)
  const other = generateKeyPairSync('ed25519')
    .publicKey.export({ type: 'spki', format: 'pem' })
    .toString()
  expect(() => verifyRegistry(signed, other)).toThrow(
    expect.objectContaining({ code: 'InvalidSignature' }),
  )
  expect(() =>
    verifyRegistry(signed.replace('"id": "test"', '"id": "test", "id": "test"'), publicKey),
  ).toThrow(expect.objectContaining({ code: 'InvalidFormat' }))
  expect(() =>
    signRegistry(
      JSON.stringify(registry).replace('"size":123', '"size":123,"size":123'),
      privateKey,
    ),
  ).toThrow()
  expect(() =>
    signRegistry(JSON.stringify({ ...registry, invalid: '\ud800' }), privateKey),
  ).toThrow(expect.objectContaining({ code: 'InvalidFormat' }))
  expect(() =>
    signRegistry(JSON.stringify(registry).replace('"size":123', '"size":1e999'), privateKey),
  ).toThrow()
})

it('resolves a signed relative location only after verification against the response URL', () => {
  const parsed = verifyRegistry(signRegistry(JSON.stringify(registry), privateKey), publicKey)
  const file = parsed.extensions[0]!.releases[0]!.artifacts[0]!
  expect(file.url).toBe('./tool.kisx')
  expect(resolveDistributionFile(file, 'https://example.org/final/index.json').url).toBe(
    'https://example.org/final/tool.kisx',
  )
  expect(file.url).toBe('./tool.kisx')
})

it('refuses overlapping targets and versions with equal SemVer precedence', () => {
  const document = { ...registry, signature: 'test' }
  expect(() =>
    parseExtensionRegistry({
      ...document,
      extensions: [
        { ...registry.extensions[0], releases: [{ ...release, artifacts: [artifact, artifact] }] },
      ],
    }),
  ).toThrow()
  expect(() =>
    parseExtensionRegistry({
      ...document,
      extensions: [
        {
          ...registry.extensions[0],
          releases: [release, { ...release, version: '1.0.0+another' }],
        },
      ],
    }),
  ).toThrow()
})

it('selects the highest compatible stable release unless prereleases are explicitly enabled', () => {
  const parsed = parseExtensionRegistry({
    ...registry,
    signature: 'test',
    extensions: [
      {
        ...registry.extensions[0],
        releases: [
          release,
          { ...release, version: '2.0.0-beta.1' },
          { ...release, version: '1.1.0' },
        ],
      },
    ],
  })
  const releases = parsed.extensions[0]!.releases
  const environment = {
    target: 'windows-x64',
    apiVersion: '1.0.0',
    nodeVersion: '24.11.1',
  } as const
  expect(selectExtensionRelease(releases, environment)?.release.version).toBe('1.1.0')
  expect(
    selectExtensionRelease(releases, environment, { allowPrerelease: true })?.release.version,
  ).toBe('2.0.0-beta.1')
  expect(selectExtensionRelease(releases, environment, { newerThan: '1.1.0' })).toBeNull()
})
