import canonicalize from 'canonicalize'
import { compareVersions } from '../compatibility'
import { DistributionError, type FieldPath } from '../errors'
import type { ExtensionManifest } from '../manifest'
import { parseMetadata } from '../metadata'
import type { RegistryArtifact, RegistryDocument, RegistryRelease } from './contracts'

export function assertManifestMatchesArtifact(
  manifest: ExtensionManifest,
  extensionId: string,
  release: RegistryRelease,
  artifact: RegistryArtifact,
): void {
  const expected = {
    id: extensionId,
    version: release.version,
    targets: artifact.targets.toSorted(),
    apiVersionRange: artifact.apiVersionRange,
    nodeVersionRange: artifact.nodeVersionRange,
    electronVersionRange: artifact.electronVersionRange,
    license: artifact.license,
  }

  for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
    const actual = key === 'targets' ? manifest.targets.toSorted() : manifest[key]
    if (canonicalize(actual) !== canonicalize(expected[key])) {
      throw new DistributionError(
        'artifact-mismatch',
        'Manifest does not match the selected artifact',
        [key],
      )
    }
  }
}

export function assertCommonMetadata(manifests: readonly ExtensionManifest[]): void {
  const first = manifests[0]
  if (!first) {
    return
  }

  const comparableMetadata = (manifest: ExtensionManifest) => ({
    id: manifest.id,
    version: manifest.version,
    ...parseMetadata({ ...manifest }, []),
  })
  const expected = canonicalize(comparableMetadata(first))

  for (const [index, manifest] of manifests.entries()) {
    if (canonicalize(comparableMetadata(manifest)) !== expected) {
      throw new DistributionError(
        'artifact-mismatch',
        'Platform packages disagree on shared display metadata',
        [index],
      )
    }
  }
}

function artifactComparisonKey(artifact: RegistryArtifact) {
  return canonicalize({ ...artifact, url: '', targets: artifact.targets.toSorted() })
}

function assertRetainedRelease(previous: RegistryRelease, next: RegistryRelease, path: FieldPath) {
  if (
    next.version !== previous.version ||
    next.publishedAt !== previous.publishedAt ||
    next.defaultLocale !== previous.defaultLocale
  ) {
    throw new DistributionError(
      'immutable-release',
      'A retained release changed its version string, publication time or default locale',
      path,
    )
  }

  const retained = new Set(previous.artifacts.map(artifactComparisonKey))
  for (const [index, artifact] of next.artifacts.entries()) {
    if (!retained.has(artifactComparisonKey(artifact))) {
      throw new DistributionError(
        'immutable-release',
        'A retained release changed its artifact or added a target',
        [...path, 'artifacts', index],
      )
    }
  }
}

export function assertRegistryUpdate(previous: RegistryDocument, next: RegistryDocument): void {
  const previousExtensions = new Map(
    previous.extensions.map((extension) => [extension.id, extension]),
  )
  for (const [extensionIndex, extension] of next.extensions.entries()) {
    const oldExtension = previousExtensions.get(extension.id)
    if (!oldExtension) {
      continue
    }
    for (const [releaseIndex, release] of extension.releases.entries()) {
      const oldRelease = oldExtension.releases.find(
        (item) => compareVersions(item.version, release.version) === 0,
      )
      if (oldRelease) {
        assertRetainedRelease(oldRelease, release, [
          'extensions',
          extensionIndex,
          'releases',
          releaseIndex,
        ])
      }
    }
  }
}
