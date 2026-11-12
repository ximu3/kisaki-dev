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
} from './validation'

/** Flat registry format version; independent of package and extension API versions. */
export const registrySchemaVersion = 1

/**
 * Location and integrity facts for one downloadable resource.
 *
 * Raw references preserve signed URL spelling; verified references resolve against the final index
 * response URL.
 */
export interface FileReference {
  readonly url: string
  /** Original byte count, not decoded text length or transfer-encoded length. */
  readonly size: number
  /** Lowercase hexadecimal digest of the complete original bytes. */
  readonly sha256: string
}

/**
 * Byte reference and compatibility requirements for one .kisx artifact shared by its target set.
 */
export interface RegistryArtifact extends FileReference, CompatibilityDeclaration {
  readonly license?: string
}

/**
 * One version's publication facts, localized notes and target-specific artifacts.
 *
 * At least one artifact is required, and each target belongs to only one artifact.
 */
export interface RegistryRelease {
  readonly version: string
  /** First publication time in UTC milliseconds, unchanged by note corrections. */
  readonly publishedAt: number

  readonly defaultLocale: string
  readonly releaseNotes?: LocalizedText
  readonly readme?: FileReference

  readonly artifacts: readonly RegistryArtifact[]
}

/**
 * An extension listing with current display metadata and available releases.
 *
 * The publisher derives display metadata from the highest stable manifest when one exists.
 */
export interface RegistryExtension extends ExtensionMetadata {
  readonly id: string
  readonly icon?: FileReference

  readonly releases: readonly RegistryRelease[]
}

/**
 * Known fields of an unsigned registry document.
 *
 * Original JSON may contain additional signed data that this typed projection omits.
 */
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

/** Parsed registry fields and root signature; authentication is a separate operation. */
export interface SignedRegistry extends RegistryDocument {
  readonly signature: string
}

/**
 * A chosen release and its compatible artifact for the requested host.
 *
 * The caller retains this selection while handling download failures.
 */
export interface SelectedRelease {
  readonly release: RegistryRelease
  readonly artifact: RegistryArtifact
}

/** Owner-supplied prerelease and version constraints for release selection. */
export interface ReleaseSelectionOptions {
  /** Defaults to false. This controls extension versions, not host runtime range semantics. */
  readonly allowPrerelease?: boolean
  /** Automatic updates supply the installed version; only strictly newer releases can be selected. */
  readonly newerThan?: string
}

/**
 * Parses a resource locator and original-byte integrity constraints.
 *
 * Preserves URL spelling; resolution and byte verification are later consumer operations.
 */
export function parseFileReference(input: unknown, path: FieldPath = []): FileReference {
  const value = parseRecord(input, path)
  return {
    url: parseUrlReference(value.url, [...path, 'url']),
    size: parseUnsignedInteger(value.size, [...path, 'size']),
    sha256: parseSha256(value.sha256, [...path, 'sha256']),
  }
}

/**
 * Validates SPKI PEM framing while preserving its spelling.
 *
 * The Node signing entry separately parses the key and requires Ed25519.
 */
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

/** Parses canonical Base64 for a 64-byte Ed25519 signature. */
export function parseSignature(input: unknown, path: FieldPath = []): string {
  const value = parseString(input, path)
  if (!/^[A-Za-z0-9+/]{85}[AQgw]==$/.test(value)) {
    rejectFormat(path, 'Expected an Ed25519 Base64 signature')
  }

  return value
}

/** Parses a .kisx reference, its target and runtime requirements, and its optional license. */
function parseArtifact(input: unknown, path: FieldPath): RegistryArtifact {
  const value = parseRecord(input, path)
  return {
    ...parseFileReference(value, path),
    ...parseCompatibility(value, path),
    ...parseOptionalField(value, 'license', path, parseString),
  }
}

/**
 * Parses publication facts and a nonempty artifact set for one release.
 *
 * Rejects targets claimed by multiple artifacts. Localized notes use the release's default locale.
 */
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

/** Parses current display metadata and a nonempty release list with distinct SemVer precedence. */
function parseExtension(input: unknown, path: FieldPath): RegistryExtension {
  const value = parseRecord(input, path)
  const releases = parseArray(value.releases, [...path, 'releases'], parseRelease)
  if (!releases.length) {
    rejectFormat([...path, 'releases'], 'An extension must provide at least one release')
  }
  assertUniqueVersions(releases, [...path, 'releases'])

  return {
    id: parseId(value.id, [...path, 'id']),
    ...parseMetadata(value, path),
    ...parseOptionalField(value, 'icon', path, parseFileReference),
    releases,
  }
}

/** Rejects equal SemVer precedence before platform or prerelease filtering. */
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
 * Parses a registry body into a fresh normalized projection of its known fields.
 *
 * Rejects duplicate extension IDs and invalid releases. Additional original JSON fields remain
 * signing data and are omitted from this projection.
 */
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

/**
 * Parses strict registry JSON and normalizes its unsigned fields.
 *
 * Duplicate keys are rejected before known-field extraction.
 */
export function parseRegistry(text: string): RegistryDocument {
  return normalizeRegistry(parseJson(text))
}

/**
 * Parses a signed registry's known fields and signature encoding.
 *
 * Authentication requires the Node signing entry and caller-supplied trust.
 */
export function parseSignedRegistry(text: string): SignedRegistry {
  const value = parseRecord(parseJson(text), [])
  return { ...normalizeRegistry(value), signature: parseSignature(value.signature, ['signature']) }
}

/**
 * Resolves a verified resource URL against the final index response URL.
 *
 * Returns a new reference with unchanged size and digest. Failed resolution throws invalid-format.
 */
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

/**
 * Selects the release that supplies the listing's current display metadata.
 *
 * Chooses the highest stable version, or the highest prerelease when none is stable. Platform
 * compatibility and publication time do not affect this choice. An empty list returns undefined.
 */
export function getCurrentRelease(
  releases: readonly RegistryRelease[],
): RegistryRelease | undefined {
  assertUniqueVersions(releases)

  const stable = releases.filter((release) => !isPrereleaseVersion(release.version))
  const candidates = stable.length ? stable : releases
  return [...candidates].sort((a, b) => compareVersions(b.version, a.version))[0]
}

/**
 * Selects the highest compatible release and its matching artifact.
 *
 * Requires validated listing and host values, then applies the supplied prerelease and newerThan
 * constraints. Returns undefined when no candidate qualifies; equal precedence is rejected before
 * filtering.
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
 * Checks a verified package manifest against its selected release and artifact.
 *
 * Compares identity, full version, targets, runtime requirements and license. Listing display text
 * is independent; archive checks and entry loading belong to the caller.
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
 * Checks shared identity and display metadata across same-version platform packages.
 *
 * Artifact conditions and licenses are compared separately. Resource readers compare icon and
 * readme bytes; equal paths alone do not establish equal content.
 */
export function assertCommonMetadata(manifests: readonly ExtensionManifest[]): void {
  const first = manifests[0]
  if (!first) {
    return
  }

  /** Projects identity and normalized display metadata for cross-platform comparison. */
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
 * Checks retained releases against the preceding registry snapshot.
 *
 * Retained versions preserve full identity, publication facts and artifact facts, including
 * existing target sets. Adding targets to a retained version is rejected. Deletions, URL relocation
 * and note corrections are allowed.
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
