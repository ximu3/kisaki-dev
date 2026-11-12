/** @fileoverview Supplies synthetic package and registry documents with no personal data or live resources. */

import type { ExtensionManifest } from '../../src/manifest'
import type { RegistryArtifact, RegistryDocument, RegistryRelease } from '../../src/registry'

/** A syntactically valid public key used only by pure format tests, never as an application trust root. */
export const fixturePublicKey =
  '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\n-----END PUBLIC KEY-----\n'

/** Creates synthetic package facts with caller-supplied field overrides. */
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

/** Creates a synthetic .kisx reference with overridable byte and compatibility facts. */
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

/** Creates a synthetic release with a fixed publication timestamp and explicit field overrides. */
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

/**
 * Creates an unsigned registry fixture with one extension and the supplied releases.
 *
 * Listing names intentionally differ from package names to exercise metadata provenance.
 */
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
