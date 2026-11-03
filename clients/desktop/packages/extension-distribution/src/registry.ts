/** @fileoverview Defines flat registry indexes, release selection and immutable artifact comparisons. */

import canonicalize from 'canonicalize'
import type {
  CompatibilityDeclaration,
  CompatibilityEnvironment,
  ExtensionTarget,
} from './compatibility'
import {
  compareVersions,
  getCompatibilityIssues,
  isPrereleaseVersion,
  parseCompatibility,
  parseVersion,
} from './compatibility'
import { DistributionError } from './errors'
import type { FieldPath } from './errors'
import type { ExtensionManifest } from './manifest'
import type { ExtensionMetadata, LocalizedText } from './metadata'
import {
  normalizeLocale,
  normalizeLocalizedText,
  parseId,
  parseMetadata,
  parseUrlReference,
} from './metadata'
import {
  array,
  invalid,
  optional,
  parseJson,
  record,
  schemaVersion,
  sha256,
  string,
  timestamp,
  unsignedInteger,
} from './validation'

/** Flat registry format version; independent of package and extension API versions. */
export const registrySchemaVersion = 1

/** Raw resource bytes, resolved against the final index response URL only after verification. */
export interface FileReference {
  readonly url: string
  /** Original byte count, not decoded text length or transfer-encoded length. */
  readonly size: number
  /** Lowercase hexadecimal digest of the complete original bytes. */
  readonly sha256: string
}

/** One complete .kisx shared by its unique target set; conditions and license belong to these bytes. */
export interface RegistryArtifact extends FileReference, CompatibilityDeclaration {
  readonly license?: string
}

/** One version, with one first-publication timestamp and shared localized release notes. */
export interface RegistryRelease {
  readonly version: string
  /** First publication time in UTC milliseconds, unchanged by note corrections. */
  readonly publishedAt: number

  readonly defaultLocale: string
  readonly releaseNotes?: LocalizedText
  readonly readme?: FileReference

  readonly artifacts: readonly RegistryArtifact[]
}

/** Current display metadata, derived by the publisher from the highest stable manifest when available. */
export interface RegistryExtension extends ExtensionMetadata {
  readonly id: string
  readonly icon?: FileReference

  readonly releases: readonly RegistryRelease[]
}

/** The unsigned business body; unknown JSON fields are permitted and remain inside the signature. */
export interface RegistryDocument {
  readonly schemaVersion: typeof registrySchemaVersion
  readonly id: string
  /** Ed25519 SPKI PEM. Its presence does not grant trust to the registry. */
  readonly publicKey: string

  readonly defaultLocale: string
  readonly name: LocalizedText
  readonly description?: LocalizedText

  readonly extensions: readonly RegistryExtension[]
}

/** A received signed index. Structural parsing alone does not authenticate it. */
export interface SignedRegistry extends RegistryDocument {
  readonly signature: string
}

/** A concrete chosen artifact; download failures must not trigger implicit reselection. */
export interface SelectedRelease {
  readonly release: RegistryRelease
  readonly artifact: RegistryArtifact
}

/** Selection preferences are supplied by the owner, never changed by manual selection. */
export interface ReleaseSelectionOptions {
  /** Defaults to false. This controls extension versions, not host runtime range semantics. */
  readonly allowPrerelease?: boolean
  /** Automatic updates supply the installed version; only strictly newer releases can be selected. */
  readonly newerThan?: string
}

/** Validate a file reference without resolving the signed URL or reading its bytes. */
export function parseFileReference(input: unknown, path: FieldPath = []): FileReference {
  const value = record(input, path)
  return {
    url: parseUrlReference(value.url, [...path, 'url']),
    size: unsignedInteger(value.size, [...path, 'size']),
    sha256: sha256(value.sha256, [...path, 'sha256']),
  }
}

/** Check PEM framing in pure code; the Node signing entry also checks the actual Ed25519 key. */
export function parsePublicKey(input: unknown, path: FieldPath = []): string {
  const value = string(input, path)
  if (
    !/^-----BEGIN PUBLIC KEY-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END PUBLIC KEY-----\r?\n?$/.test(
      value,
    )
  ) {
    invalid(path, 'Expected an SPKI PEM public key')
  }
  return value
}

/** Require the canonical Base64 representation of a 64-byte Ed25519 signature. */
export function parseSignature(input: unknown, path: FieldPath = []): string {
  const value = string(input, path)
  if (/^[A-Za-z0-9+/]{85}[AQgw]==$/.exec(value)?.[0] !== value) {
    invalid(path, 'Expected an Ed25519 Base64 signature')
  }
  return value
}

function parseArtifact(input: unknown, path: FieldPath): RegistryArtifact {
  const value = record(input, path)
  return {
    ...parseFileReference(value, path),
    ...parseCompatibility(value, path),
    ...optional(value, 'license', path, string),
  }
}

function parseRelease(input: unknown, path: FieldPath): RegistryRelease {
  const value = record(input, path)
  const defaultLocale = normalizeLocale(value.defaultLocale, [...path, 'defaultLocale'])

  const artifacts = array(value.artifacts, [...path, 'artifacts'], parseArtifact)
  if (!artifacts.length) {
    invalid([...path, 'artifacts'], 'A release must provide at least one artifact')
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
    publishedAt: timestamp(value.publishedAt, [...path, 'publishedAt']),

    defaultLocale,
    ...optional(value, 'releaseNotes', path, (text, location) =>
      normalizeLocalizedText(text, defaultLocale, location),
    ),
    ...optional(value, 'readme', path, parseFileReference),

    artifacts,
  }
}

function parseExtension(input: unknown, path: FieldPath): RegistryExtension {
  const value = record(input, path)
  const releases = array(value.releases, [...path, 'releases'], parseRelease)
  if (!releases.length) {
    invalid([...path, 'releases'], 'An extension must provide at least one release')
  }
  assertUniqueVersions(releases, [...path, 'releases'])

  return {
    id: parseId(value.id, [...path, 'id']),
    ...parseMetadata(value, path),
    ...optional(value, 'icon', path, parseFileReference),
    releases,
  }
}

/** Reject ambiguous precedence before filtering by platform or prerelease preference. */
function assertUniqueVersions(releases: readonly RegistryRelease[], path: FieldPath = []): void {
  const ordered = releases
    .map((release, index) => ({ release, index }))
    .sort((a, b) => compareVersions(a.release.version, b.release.version))

  for (let i = 1; i < ordered.length; i += 1) {
    if (compareVersions(ordered[i - 1]!.release.version, ordered[i]!.release.version) === 0) {
      throw new DistributionError(
        'version-conflict',
        'Release versions have equal SemVer precedence',
        [...path, ordered[i]!.index, 'version'],
      )
    }
  }
}

/**
 * Validate an unsigned body and normalize its known fields into a fresh value.
 * Unknown fields are not returned; signing must operate on the original JSON, never this projection.
 */
export function normalizeRegistry(input: unknown): RegistryDocument {
  const value = record(input, [])
  const defaultLocale = normalizeLocale(value.defaultLocale, ['defaultLocale'])

  const extensions = array(value.extensions, ['extensions'], parseExtension)
  const ids = new Set<string>()
  for (const [index, extension] of extensions.entries()) {
    if (ids.has(extension.id)) {
      invalid(['extensions', index, 'id'], 'Duplicate extension ID')
    }
    ids.add(extension.id)
  }

  return {
    schemaVersion: schemaVersion(value.schemaVersion, ['schemaVersion']),
    id: parseId(value.id, ['id']),
    publicKey: parsePublicKey(value.publicKey, ['publicKey']),

    defaultLocale,
    name: normalizeLocalizedText(value.name, defaultLocale, ['name']),
    ...optional(value, 'description', [], (text, location) =>
      normalizeLocalizedText(text, defaultLocale, location),
    ),

    extensions,
  }
}

/** Parse an unsigned authoring document, rejecting duplicate JSON keys before normalization. */
export function parseRegistry(text: string): RegistryDocument {
  return normalizeRegistry(parseJson(text))
}

/** Parse a signed index's structure only. Authentication requires node/signing with explicit trust. */
export function parseSignedRegistry(text: string): SignedRegistry {
  const value = record(parseJson(text), [])
  return { ...normalizeRegistry(value), signature: parseSignature(value.signature, ['signature']) }
}

/** Resolve a verified reference against the final response URL, retaining its byte constraints. */
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

/** Select display provenance independently of platform, upload time and installation state. */
export function getCurrentRelease(
  releases: readonly RegistryRelease[],
): RegistryRelease | undefined {
  assertUniqueVersions(releases)

  const stable = releases.filter((release) => !isPrereleaseVersion(release.version))
  const candidates = stable.length ? stable : releases
  return [...candidates].sort((a, b) => compareVersions(b.version, a.version))[0]
}

/**
 * Choose the highest compatible release, or undefined when no candidate satisfies the conditions.
 * Expects a validated listing; duplicate precedence is still rejected rather than used as a tie-breaker.
 */
export function selectRelease(
  extension: RegistryExtension,
  environment: CompatibilityEnvironment,
  options: ReleaseSelectionOptions = {},
): SelectedRelease | undefined {
  assertUniqueVersions(extension.releases)
  if (options.newerThan !== undefined) {
    parseVersion(options.newerThan)
  }

  const releases = [...extension.releases].sort((a, b) => compareVersions(b.version, a.version))
  for (const release of releases) {
    if (
      (!options.allowPrerelease && isPrereleaseVersion(release.version)) ||
      (options.newerThan !== undefined && compareVersions(release.version, options.newerThan) <= 0)
    ) {
      continue
    }

    const artifact = release.artifacts.find(
      (candidate) => getCompatibilityIssues(candidate, environment).length === 0,
    )
    if (artifact) {
      return { release, artifact }
    }
  }

  return undefined
}

/**
 * Check package identity and artifact-specific conditions after the caller verifies its bytes.
 * Display metadata may differ from the current listing. File existence and ESM loading remain caller-owned.
 */
export function assertManifestMatchesArtifact(
  manifest: ExtensionManifest,
  extensionId: string,
  release: RegistryRelease,
  artifact: RegistryArtifact,
): void {
  const expected = {
    id: extensionId,
    version: release.version,
    targets: [...artifact.targets].sort(),
    apiVersionRange: artifact.apiVersionRange,
    nodeVersionRange: artifact.nodeVersionRange,
    electronVersionRange: artifact.electronVersionRange,
    license: artifact.license,
  }

  for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
    const actual = key === 'targets' ? [...manifest.targets].sort() : manifest[key]
    if (canonicalize(actual) !== canonicalize(expected[key])) {
      throw new DistributionError(
        'artifact-mismatch',
        'Manifest does not match the selected artifact',
        [key],
      )
    }
  }
}

/**
 * Compare shared display facts of same-version platform packages, excluding artifact-specific conditions.
 * Resource readers separately compare actual icon/readme bytes; a shared path does not prove equal content.
 */
export function assertCommonMetadata(manifests: readonly ExtensionManifest[]): void {
  const first = manifests[0]
  if (!first) {
    return
  }

  const shared = (manifest: ExtensionManifest) => ({
    id: manifest.id,
    version: manifest.version,
    ...parseMetadata({ ...manifest }, []),
  })
  const expected = canonicalize(shared(first))

  for (const [index, manifest] of manifests.entries()) {
    if (canonicalize(shared(manifest)) !== expected) {
      throw new DistributionError(
        'artifact-mismatch',
        'Platform packages disagree on shared display metadata',
        [index],
      )
    }
  }
}

/**
 * Reject changed bytes, added targets or changed first-publication facts in retained releases.
 * Deletions, URL relocation and note corrections are allowed. No permanent history is maintained.
 */
export function assertRegistryUpdate(previous: RegistryDocument, next: RegistryDocument): void {
  for (const [extensionIndex, extension] of next.extensions.entries()) {
    const oldExtension = previous.extensions.find((item) => item.id === extension.id)

    for (const [releaseIndex, release] of extension.releases.entries()) {
      const oldRelease = oldExtension?.releases.find(
        (item) => compareVersions(item.version, release.version) === 0,
      )
      if (!oldRelease) {
        continue
      }

      if (
        release.version !== oldRelease.version ||
        release.publishedAt !== oldRelease.publishedAt ||
        release.defaultLocale !== oldRelease.defaultLocale
      ) {
        throw new DistributionError(
          'immutable-release',
          'A retained release changed its identity or publication facts',
          ['extensions', extensionIndex, 'releases', releaseIndex],
        )
      }

      for (const [artifactIndex, artifact] of release.artifacts.entries()) {
        for (const target of artifact.targets) {
          const oldArtifact = oldRelease.artifacts.find((item) => item.targets.includes(target))
          if (
            !oldArtifact ||
            canonicalize({ ...artifact, url: '', targets: [...artifact.targets].sort() }) !==
              canonicalize({ ...oldArtifact, url: '', targets: [...oldArtifact.targets].sort() })
          ) {
            throw new DistributionError(
              'immutable-release',
              'A retained release changed its artifact or added a target',
              ['extensions', extensionIndex, 'releases', releaseIndex, 'artifacts', artifactIndex],
            )
          }
        }
      }
    }
  }
}
