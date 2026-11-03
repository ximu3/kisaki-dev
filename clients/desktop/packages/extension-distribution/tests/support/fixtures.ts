/** @fileoverview Supplies synthetic package and registry documents with no personal data or live resources. */

import type { ExtensionManifest } from '../../src/manifest'
import type { RegistryArtifact, RegistryDocument, RegistryRelease } from '../../src/registry'

/** A syntactically valid public key used only by pure format tests, never as an application trust root. */
export const fixturePublicKey =
  '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\n-----END PUBLIC KEY-----\n'

/** Create complete package facts for tests; overrides intentionally allow independent runtime conditions. */
export function manifest(overrides: Partial<ExtensionManifest> = {}): ExtensionManifest {
  return {
    schemaVersion: 1,
    id: 'sample',
    version: '1.0.0',
    targets: ['windows-x64'],
    apiVersionRange: '^1.0.0',
    defaultLocale: 'en',
    name: { en: 'Sample', 'zh-Hans': '示例' },
    entry: 'node/entry.js',
    ...overrides,
  }
}

/** Create one synthetic archive reference; no file is downloaded by these tests. */
export function artifact(overrides: Partial<RegistryArtifact> = {}): RegistryArtifact {
  return {
    targets: ['windows-x64'],
    apiVersionRange: '^1.0.0',
    url: './sample.kisx',
    size: 100,
    sha256: 'a'.repeat(64),
    ...overrides,
  }
}

/** Create a release with a fixed timestamp, independent of test order and the current clock. */
export function release(
  version = '1.0.0',
  overrides: Partial<RegistryRelease> = {},
): RegistryRelease {
  return {
    version,
    publishedAt: 1_700_000_000_000,
    defaultLocale: 'en',
    artifacts: [artifact()],
    ...overrides,
  }
}

/** Create an unsigned, populated flat registry with its current display separate from package facts. */
export function registry(
  releases: readonly RegistryRelease[] = [release()],
  publicKey = fixturePublicKey,
): RegistryDocument {
  return {
    schemaVersion: 1,
    id: 'sample.registry',
    publicKey,
    defaultLocale: 'en',
    name: 'Sample registry',
    extensions: [{ id: 'sample', defaultLocale: 'en', name: 'Current sample name', releases }],
  }
}
