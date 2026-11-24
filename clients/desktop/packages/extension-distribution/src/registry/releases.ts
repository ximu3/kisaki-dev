import {
  compareVersions,
  getCompatibilityIssues,
  isPrereleaseVersion,
  parseVersion,
  type CompatibilityEnvironment,
} from '../compatibility'
import { DistributionError, type FieldPath } from '../errors'
import type { RegistryArtifact, RegistryExtension, RegistryRelease } from './contracts'

export interface SelectedRelease {
  readonly release: RegistryRelease
  readonly artifact: RegistryArtifact
}

export interface ReleaseSelectionOptions {
  readonly allowPrerelease?: boolean
  readonly newerThan?: string
}

export function rankReleases(
  releases: readonly RegistryRelease[],
  path: FieldPath = [],
): RegistryRelease[] {
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

  return ordered.reverse().map(({ release }) => release)
}

export function getCurrentRelease(
  releases: readonly RegistryRelease[],
): RegistryRelease | undefined {
  const ranked = rankReleases(releases)
  return ranked.find((release) => !isPrereleaseVersion(release.version)) ?? ranked[0]
}

export function selectRelease(
  extension: RegistryExtension,
  environment: CompatibilityEnvironment,
  options: ReleaseSelectionOptions = {},
): SelectedRelease | undefined {
  const releases = rankReleases(extension.releases)
  if (options.newerThan !== undefined) {
    parseVersion(options.newerThan)
  }

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
