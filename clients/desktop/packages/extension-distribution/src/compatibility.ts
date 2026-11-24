import { compare, parse, prerelease, satisfies, validRange } from 'semver'
import type { FieldPath } from './errors'
import { parseArray, rejectFormat, parseOptionalField, parseString } from './validation'

export const extensionTargets = Object.freeze([
  'windows-x64',
  'windows-arm64',
  'macos-x64',
  'macos-arm64',
  'linux-x64',
  'linux-arm64',
] as const)

export type ExtensionTarget = (typeof extensionTargets)[number]

export interface CompatibilityDeclaration {
  readonly targets: readonly ExtensionTarget[]
  readonly apiVersionRange: string
  readonly nodeVersionRange?: string
  readonly electronVersionRange?: string
}

export interface CompatibilityEnvironment {
  readonly target: ExtensionTarget
  readonly apiVersion: string
  readonly nodeVersion?: string
  readonly electronVersion?: string
}

export type CompatibilityIssue =
  | {
      readonly condition: 'target'
      readonly required: readonly ExtensionTarget[]
      readonly actual: ExtensionTarget
    }
  | {
      readonly condition: 'apiVersion'
      readonly required: string
      readonly actual: string
    }
  | {
      readonly condition: 'nodeVersion' | 'electronVersion'
      readonly required: string
      readonly actual?: string
    }

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

export function parseVersionRange(input: unknown, path: FieldPath = []): string {
  const value = parseString(input, path)
  if (validRange(value) === null) {
    rejectFormat(path, 'Expected a SemVer range')
  }

  return value
}

export function parseTarget(input: unknown, path: FieldPath = []): ExtensionTarget {
  const value = parseString(input, path)
  const target = extensionTargets.find((known) => known === value)
  if (target === undefined) {
    rejectFormat(path, 'Unsupported extension target')
  }

  return target
}

export function normalizeTargets(input: unknown, path: FieldPath = []): ExtensionTarget[] {
  const targets = parseArray(input, path, parseTarget)
  if (!targets.length || new Set(targets).size !== targets.length) {
    rejectFormat(path, 'Expected nonempty unique extension targets')
  }

  return targets.sort()
}

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

export function getCompatibilityIssues(
  declaration: CompatibilityDeclaration,
  environment: CompatibilityEnvironment,
): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = []
  if (!declaration.targets.includes(environment.target)) {
    issues.push({ condition: 'target', required: declaration.targets, actual: environment.target })
  }
  if (!satisfies(environment.apiVersion, declaration.apiVersionRange)) {
    issues.push({
      condition: 'apiVersion',
      required: declaration.apiVersionRange,
      actual: environment.apiVersion,
    })
  }

  const conditions = [
    ['nodeVersion', declaration.nodeVersionRange, environment.nodeVersion],
    ['electronVersion', declaration.electronVersionRange, environment.electronVersion],
  ] as const
  for (const [condition, required, actual] of conditions) {
    if (required !== undefined && (actual === undefined || !satisfies(actual, required))) {
      issues.push({ condition, required, ...(actual === undefined ? {} : { actual }) })
    }
  }

  return issues
}

export function compareVersions(left: string, right: string): number {
  return compare(parseVersion(left), parseVersion(right))
}

export function isPrereleaseVersion(version: string): boolean {
  return prerelease(parseVersion(version)) !== null
}
