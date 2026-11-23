import canonicalize from 'canonicalize'
import { compareVersions } from '../compatibility'
import { DistributionError } from '../errors'
import type { ExtensionManifest } from '../manifest'
import { parseMetadata } from '../metadata'
import type { RegistryArtifact, RegistryDocument, RegistryRelease } from './contracts'

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

/**
 * Checks retained releases against the preceding registry snapshot.
 *
 * Retained releases keep their exact version string, publication time and default locale, and
 * cannot gain targets. Each retained artifact keeps its contents, metadata and target set.
 * Deletions, URL relocation and corrections to release notes are allowed.
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
          'A retained release changed its version string, publication time or default locale',
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
