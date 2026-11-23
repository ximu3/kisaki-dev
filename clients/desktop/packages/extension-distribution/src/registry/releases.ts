import {
  compareVersions,
  getCompatibilityIssues,
  isPrereleaseVersion,
  parseVersion,
  type CompatibilityEnvironment,
} from '../compatibility'
import { DistributionError, type FieldPath } from '../errors'
import type { RegistryArtifact, RegistryExtension, RegistryRelease } from './contracts'

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

/**
 * Selects the release that supplies the listing's current display metadata.
 *
 * Chooses the highest stable version, or the highest prerelease when none is stable. Platform
 * compatibility and publication time do not affect this choice. An empty list returns undefined.
 */
export function getCurrentRelease(
  releases: readonly RegistryRelease[],
): RegistryRelease | undefined {
  const ranked = rankReleases(releases)
  return ranked.find((release) => !isPrereleaseVersion(release.version)) ?? ranked[0]
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
