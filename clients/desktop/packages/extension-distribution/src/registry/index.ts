import { parseCompatibility, parseVersion, type ExtensionTarget } from '../compatibility'
import { DistributionError, type FieldPath } from '../errors'
import {
  normalizeLocale,
  normalizeLocalizedText,
  parseId,
  parseMetadata,
  parseUrlReference,
} from '../metadata'
import {
  parseArray,
  rejectFormat,
  parseOptionalField,
  parseJson,
  parseRecord,
  parseSchemaVersion,
  parseSha256,
  parseString,
  parseTimestamp,
  parseUnsignedInteger,
} from '../validation'
import type {
  FileReference,
  RegistryArtifact,
  RegistryDocument,
  RegistryExtension,
  RegistryRelease,
  SignedRegistry,
} from './contracts'
import { rankReleases } from './releases'

export { registrySchemaVersion } from './contracts'
export type {
  FileReference,
  RegistryArtifact,
  RegistryDocument,
  RegistryExtension,
  RegistryRelease,
  SignedRegistry,
} from './contracts'
export {
  getCurrentRelease,
  selectRelease,
  type ReleaseSelectionOptions,
  type SelectedRelease,
} from './releases'
export {
  assertCommonMetadata,
  assertManifestMatchesArtifact,
  assertRegistryUpdate,
} from './publication'

export function parseFileReference(input: unknown, path: FieldPath = []): FileReference {
  const value = parseRecord(input, path)
  return {
    url: parseUrlReference(value.url, [...path, 'url']),
    size: parseUnsignedInteger(value.size, [...path, 'size']),
    sha256: parseSha256(value.sha256, [...path, 'sha256']),
  }
}

export function parsePublicKey(input: unknown, path: FieldPath = []): string {
  const value = parseString(input, path)
  if (
    !/^-----BEGIN PUBLIC KEY-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END PUBLIC KEY-----\r?\n?$/.test(
      value,
    )
  ) {
    rejectFormat(path, 'Expected an SPKI PEM public key')
  }

  return value
}

export function parseSignature(input: unknown, path: FieldPath = []): string {
  const value = parseString(input, path)
  if (!/^[A-Za-z0-9+/]{85}[AQgw]==$/.test(value)) {
    rejectFormat(path, 'Expected an Ed25519 Base64 signature')
  }

  return value
}

function parseArtifact(input: unknown, path: FieldPath): RegistryArtifact {
  const value = parseRecord(input, path)
  return {
    ...parseFileReference(value, path),
    ...parseCompatibility(value, path),
    ...parseOptionalField(value, 'license', path, parseString),
  }
}

function parseRelease(input: unknown, path: FieldPath): RegistryRelease {
  const value = parseRecord(input, path)
  const defaultLocale = normalizeLocale(value.defaultLocale, [...path, 'defaultLocale'])

  const artifacts = parseArray(value.artifacts, [...path, 'artifacts'], parseArtifact)
  if (!artifacts.length) {
    rejectFormat([...path, 'artifacts'], 'A release must provide at least one artifact')
  }

  const targets = new Set<ExtensionTarget>()
  for (const [index, artifact] of artifacts.entries()) {
    for (const target of artifact.targets) {
      if (targets.has(target)) {
        throw new DistributionError(
          'target-conflict',
          'A release target belongs to more than one artifact',
          [...path, 'artifacts', index, 'targets'],
        )
      }
      targets.add(target)
    }
  }

  return {
    version: parseVersion(value.version, [...path, 'version']),
    publishedAt: parseTimestamp(value.publishedAt, [...path, 'publishedAt']),

    defaultLocale,
    ...parseOptionalField(value, 'releaseNotes', path, (text, location) =>
      normalizeLocalizedText(text, defaultLocale, location),
    ),
    ...parseOptionalField(value, 'readme', path, parseFileReference),

    artifacts,
  }
}

function parseExtension(input: unknown, path: FieldPath): RegistryExtension {
  const value = parseRecord(input, path)
  const releases = parseArray(value.releases, [...path, 'releases'], parseRelease)
  if (!releases.length) {
    rejectFormat([...path, 'releases'], 'An extension must provide at least one release')
  }
  rankReleases(releases, [...path, 'releases'])

  return {
    id: parseId(value.id, [...path, 'id']),
    ...parseMetadata(value, path),
    ...parseOptionalField(value, 'icon', path, parseFileReference),
    releases,
  }
}

export function normalizeRegistry(input: unknown): RegistryDocument {
  const value = parseRecord(input, [])
  const defaultLocale = normalizeLocale(value.defaultLocale, ['defaultLocale'])

  const extensions = parseArray(value.extensions, ['extensions'], parseExtension)
  const ids = new Set<string>()
  for (const [index, extension] of extensions.entries()) {
    if (ids.has(extension.id)) {
      rejectFormat(['extensions', index, 'id'], 'Duplicate extension ID')
    }
    ids.add(extension.id)
  }

  return {
    schemaVersion: parseSchemaVersion(value.schemaVersion, ['schemaVersion']),
    id: parseId(value.id, ['id']),
    publicKey: parsePublicKey(value.publicKey, ['publicKey']),

    defaultLocale,
    name: normalizeLocalizedText(value.name, defaultLocale, ['name']),
    ...parseOptionalField(value, 'description', [], (text, location) =>
      normalizeLocalizedText(text, defaultLocale, location),
    ),

    extensions,
  }
}

export function parseRegistry(text: string): RegistryDocument {
  return normalizeRegistry(parseJson(text))
}

export function parseSignedRegistry(text: string): SignedRegistry {
  const value = parseRecord(parseJson(text), [])
  return { ...normalizeRegistry(value), signature: parseSignature(value.signature, ['signature']) }
}

export function resolveFileReference(reference: FileReference, responseUrl: string): FileReference {
  try {
    return { ...reference, url: new URL(reference.url, responseUrl).href }
  } catch (cause) {
    throw new DistributionError(
      'invalid-format',
      'Cannot resolve registry file reference',
      ['url'],
      { cause },
    )
  }
}
