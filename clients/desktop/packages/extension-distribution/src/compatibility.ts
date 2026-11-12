/** @fileoverview Defines target and SemVer conditions shared by discovery, installation and activation. */

import { compare, parse, prerelease, satisfies, validRange } from 'semver'
import type { FieldPath } from './errors'
import { parseArray, rejectFormat, parseOptionalField, parseString } from './validation'

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

/** OS, process-architecture and runtime requirements declared by one extension artifact. */
export interface CompatibilityDeclaration {
  readonly targets: readonly ExtensionTarget[]
  readonly apiVersionRange: string
  readonly nodeVersionRange?: string
  readonly electronVersionRange?: string
}

/**
 * Target and runtime versions observed by the consuming host.
 *
 * An omitted runtime cannot satisfy a corresponding declared version range.
 */
export interface CompatibilityEnvironment {
  readonly target: ExtensionTarget
  readonly apiVersion: string
  readonly nodeVersion?: string
  readonly electronVersion?: string
}

/**
 * One unmet artifact requirement and the host value used for comparison.
 *
 * An undefined actual value identifies a runtime absent from the host.
 */
export interface CompatibilityIssue {
  readonly condition: 'target' | 'apiVersion' | 'nodeVersion' | 'electronVersion'
  readonly required: string | readonly ExtensionTarget[]
  readonly actual: string | undefined
}

/** Parses a canonical full SemVer version and preserves its spelling, including build metadata. */
export function parseVersion(input: unknown, path: FieldPath = []): string {
  const value = parseString(input, path)
  const version = parse(value)
  if (version === null) {
    rejectFormat(path, 'Expected a SemVer version')
  }

  const build = version.build.length ? `+${version.build.join('.')}` : ''
  if (`${version.version}${build}` !== value) {
    rejectFormat(path, 'Expected a canonical SemVer version')
  }

  return value
}

/** Validates a SemVer range and preserves its authored spelling for artifact comparisons. */
export function parseVersionRange(input: unknown, path: FieldPath = []): string {
  const value = parseString(input, path)
  if (validRange(value) === null) {
    rejectFormat(path, 'Expected a SemVer range')
  }

  return value
}

/** Parses one supported OS and process-architecture target. */
export function parseTarget(input: unknown, path: FieldPath = []): ExtensionTarget {
  const target = parseString(input, path)
  if (!extensionTargets.some((known) => known === target)) {
    rejectFormat(path, 'Unsupported extension target')
  }

  return target as ExtensionTarget
}

/** Normalizes a nonempty, duplicate-free target list into a sorted copy. */
export function normalizeTargets(input: unknown, path: FieldPath = []): ExtensionTarget[] {
  const targets = parseArray(input, path, parseTarget)
  if (!targets.length || new Set(targets).size !== targets.length) {
    rejectFormat(path, 'Expected nonempty unique extension targets')
  }

  return targets.sort()
}

/**
 * Maps Node platform and process architecture to an extension target.
 *
 * Unsupported pairs return undefined.
 */
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

/** Parses compatibility fields from a previously checked document object. */
export function parseCompatibility(
  value: Record<string, unknown>,
  path: FieldPath = [],
): CompatibilityDeclaration {
  return {
    targets: normalizeTargets(value.targets, [...path, 'targets']),
    apiVersionRange: parseVersionRange(value.apiVersionRange, [...path, 'apiVersionRange']),
    ...parseOptionalField(value, 'nodeVersionRange', path, parseVersionRange),
    ...parseOptionalField(value, 'electronVersionRange', path, parseVersionRange),
  }
}

/**
 * Reports all declared requirements the host fails to satisfy.
 *
 * Accepts validated artifact requirements and observed host versions. Runtime prereleases follow
 * SemVer range matching; release-channel preferences belong to release selection.
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

/**
 * Compares canonical versions by SemVer precedence.
 *
 * Returns a negative value when left is lower, zero at equal precedence, and a positive value when
 * left is higher. Build metadata does not break a tie.
 */
export function compareVersions(left: string, right: string): number {
  return compare(parseVersion(left), parseVersion(right))
}

/** Reports whether a canonical version contains prerelease identifiers. */
export function isPrereleaseVersion(version: string): boolean {
  return prerelease(parseVersion(version)) !== null
}
