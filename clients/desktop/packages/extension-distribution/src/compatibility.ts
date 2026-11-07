/** @fileoverview Defines target and SemVer conditions shared by discovery, installation and activation. */

import { compare, parse, prerelease, satisfies, validRange } from 'semver'
import type { FieldPath } from './errors'
import { array, invalid, optional, string } from './validation'

/** Supported host OS and process-architecture pairs; order does not express preference. */
export const extensionTargets = Object.freeze([
  'windows-x64',
  'windows-arm64',
  'macos-x64',
  'macos-arm64',
  'linux-x64',
  'linux-arm64',
] as const)

/** A package target describes the host process architecture, not hardware emulation capability. */
export type ExtensionTarget = (typeof extensionTargets)[number]

/** Runtime requirements belonging to one immutable artifact. */
export interface CompatibilityDeclaration {
  readonly targets: readonly ExtensionTarget[]
  readonly apiVersionRange: string
  readonly nodeVersionRange?: string
  readonly electronVersionRange?: string
}

/** Actual host versions; omitted optional runtimes fail an explicitly declared requirement. */
export interface CompatibilityEnvironment {
  readonly target: ExtensionTarget
  readonly apiVersion: string
  readonly nodeVersion?: string
  readonly electronVersion?: string
}

/** One unsatisfied condition for display; all failed conditions are returned together. */
export interface CompatibilityIssue {
  readonly condition: 'target' | 'apiVersion' | 'nodeVersion' | 'electronVersion'
  readonly required: string | readonly ExtensionTarget[]
  readonly actual: string | undefined
}

/** Parse a full SemVer spelling, retaining build metadata without assigning it precedence. */
export function parseVersion(input: unknown, path: FieldPath = []): string {
  const value = string(input, path)
  const version = parse(value)
  if (version === null) {
    invalid(path, 'Expected a SemVer version')
  }

  const build = version.build.length ? `+${version.build.join('.')}` : ''
  if (`${version.version}${build}` !== value) {
    invalid(path, 'Expected a canonical SemVer version')
  }

  return value
}

/** Validate a Node SemVer range and preserve its authored spelling for artifact comparisons. */
export function parseVersionRange(input: unknown, path: FieldPath = []): string {
  const value = string(input, path)
  if (validRange(value) === null) {
    invalid(path, 'Expected a SemVer range')
  }

  return value
}

/** Validate one supported target; unknown host pairs are not coerced into supported targets. */
export function parseTarget(input: unknown, path: FieldPath = []): ExtensionTarget {
  const target = string(input, path)
  if (!extensionTargets.some((known) => known === target)) {
    invalid(path, 'Unsupported extension target')
  }

  return target as ExtensionTarget
}

/** Require at least one unique target and sort a new array to make order immaterial. */
export function normalizeTargets(input: unknown, path: FieldPath = []): ExtensionTarget[] {
  const targets = array(input, path, parseTarget)
  if (!targets.length || new Set(targets).size !== targets.length) {
    invalid(path, 'Expected nonempty unique extension targets')
  }

  return targets.sort()
}

/** Map Node platform and process.arch values to a target; unsupported pairs return undefined. */
export function targetForPlatform(
  platform: string,
  architecture: string,
): ExtensionTarget | undefined {
  const operatingSystems: Readonly<Record<string, string>> = {
    win32: 'windows',
    darwin: 'macos',
    linux: 'linux',
  }
  const target = `${operatingSystems[platform]}-${architecture}`
  return extensionTargets.find((known) => known === target)
}

/** Read compatibility fields from a previously checked document object. */
export function parseCompatibility(
  value: Record<string, unknown>,
  path: FieldPath = [],
): CompatibilityDeclaration {
  return {
    targets: normalizeTargets(value.targets, [...path, 'targets']),
    apiVersionRange: parseVersionRange(value.apiVersionRange, [...path, 'apiVersionRange']),
    ...optional(value, 'nodeVersionRange', path, parseVersionRange),
    ...optional(value, 'electronVersionRange', path, parseVersionRange),
  }
}

/**
 * Report every incompatible host condition. Inputs are validated declarations and actual host values.
 * Runtime prereleases follow SemVer range rules; extension release preferences are separate.
 */
export function getCompatibilityIssues(
  declaration: CompatibilityDeclaration,
  environment: CompatibilityEnvironment,
): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = []
  if (!declaration.targets.includes(environment.target)) {
    issues.push({ condition: 'target', required: declaration.targets, actual: environment.target })
  }

  const conditions = [
    ['apiVersion', declaration.apiVersionRange, environment.apiVersion],
    ['nodeVersion', declaration.nodeVersionRange, environment.nodeVersion],
    ['electronVersion', declaration.electronVersionRange, environment.electronVersion],
  ] as const
  for (const [condition, required, actual] of conditions) {
    if (required !== undefined && (actual === undefined || !satisfies(actual, required))) {
      issues.push({ condition, required, actual })
    }
  }

  return issues
}

/** Compare valid versions by SemVer precedence; build metadata never breaks a tie. */
export function compareVersions(left: string, right: string): number {
  return compare(parseVersion(left), parseVersion(right))
}

/** Whether a valid extension version has prerelease identifiers, regardless of build metadata. */
export function isPrereleaseVersion(version: string): boolean {
  return prerelease(parseVersion(version)) !== null
}
