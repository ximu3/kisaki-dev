/** @fileoverview Evaluates declared runtime conditions and selects an unambiguous compatible release. */

import { compare, prerelease, satisfies } from 'semver'
import type { ExtensionRequirements, ExtensionTarget } from './manifest'
import type { ExtensionArtifact, ExtensionRelease } from './registry'

/** Actual host runtime values; Electron is absent in hosts that do not run it. */
export interface ExtensionEnvironment {
  readonly target: ExtensionTarget
  readonly apiVersion: string
  readonly nodeVersion: string
  readonly electronVersion?: string
}

/** A concrete unsatisfied declaration, for display without interpreting a dependency's error text. */
export type CompatibilityIssue =
  | {
      readonly condition: 'target'
      readonly required: readonly ExtensionTarget[]
      readonly actual: ExtensionTarget
    }
  | {
      readonly condition: 'api' | 'node' | 'electron'
      readonly required: string
      readonly actual: string | null
    }

/** Valid declarations are either compatible or explain every unmet condition. */
export type ExtensionCompatibility =
  | { readonly status: 'compatible' }
  | { readonly status: 'incompatible'; readonly issues: readonly CompatibilityIssue[] }
  | { readonly status: 'unavailable' }

/** Check already parsed declarations against actual runtime values, without granting API permissions. */
export function checkExtensionCompatibility(
  requirements: ExtensionRequirements,
  environment: ExtensionEnvironment,
): ExtensionCompatibility {
  const issues: CompatibilityIssue[] = []
  if (!requirements.targets.includes(environment.target)) {
    issues.push({ condition: 'target', required: requirements.targets, actual: environment.target })
  }
  for (const [condition, range, actual] of [
    ['api', requirements.apiVersionRange, environment.apiVersion],
    ['node', requirements.nodeVersionRange, environment.nodeVersion],
    ['electron', requirements.electronVersionRange, environment.electronVersion],
  ] as const) {
    if (range !== undefined && (actual === undefined || !satisfies(actual, range))) {
      issues.push({ condition, required: range, actual: actual ?? null })
    }
  }
  return issues.length ? { status: 'incompatible', issues } : { status: 'compatible' }
}

/**
 * Select the highest compatible release from a parsed registry. No fallback occurs after a
 * selected artifact's download or verification fails; a newerThan constraint never downgrades.
 */
export function selectExtensionRelease(
  releases: readonly ExtensionRelease[],
  environment: ExtensionEnvironment,
  options: { readonly allowPrerelease?: boolean; readonly newerThan?: string } = {},
): { readonly release: ExtensionRelease; readonly artifact: ExtensionArtifact } | null {
  let selected: { release: ExtensionRelease; artifact: ExtensionArtifact } | null = null
  for (const release of releases) {
    if (
      (!options.allowPrerelease && prerelease(release.version)) ||
      (options.newerThan !== undefined && compare(release.version, options.newerThan) <= 0)
    ) {
      continue
    }
    const artifact = release.artifacts.find(
      (candidate) => checkExtensionCompatibility(candidate, environment).status === 'compatible',
    )
    if (artifact && (selected === null || compare(release.version, selected.release.version) > 0)) {
      selected = { release, artifact }
    }
  }
  return selected
}
