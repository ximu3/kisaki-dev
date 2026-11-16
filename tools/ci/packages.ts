/** @fileoverview Registers package verification tasks and the runner facilities each task uses. */

import type { Project } from '../workspace.ts'

/** GitHub-hosted runners for the supported operating systems and architectures. */
export const runners = {
  'linux-x64': 'ubuntu-22.04',
  'linux-arm64': 'ubuntu-22.04-arm',
  'windows-x64': 'windows-2025',
  'windows-arm64': 'windows-11-arm',
  'macos-x64': 'macos-15-intel',
  'macos-arm64': 'macos-15',
} as const

/** An operating system and architecture with a native runner. */
type Target = keyof typeof runners

/** All supported native hosts, including the Linux host used by Workspace checks. */
const nativeTargets = Object.keys(runners) as Target[]

/** Host facilities and package-relative evidence for one local task. */
interface TaskEnvironment {
  chromium?: boolean
  window?: boolean
  linuxPackages?: readonly string[]
  performanceReport?: string
}

/** A package's automatic check and the tasks available for reproduction. */
interface PackageChecks {
  defaultTask: string
  targets: readonly Target[]
  manualTargets?: readonly Target[]
  tasks: Readonly<Record<string, TaskEnvironment>>
  macosDeploymentTarget?: string
}

/** A candidate workspace member with its applicable host and task policy. */
export type VerificationPackage = Project & PackageChecks

/** The browser executable for headless Playwright checks. */
const chromium = { chromium: true }

/** Additional facilities used by each public package's independent consumer installations. */
const consumerEnvironments: Readonly<Record<string, TaskEnvironment>> = {
  '@kisaki3/desktop-appearance': chromium,
  '@kisaki3/desktop-contracts': chromium,
  '@kisaki3/desktop-localization': chromium,
  '@kisaki3/desktop-rpc': { window: true },
  '@kisaki3/desktop-ui': { chromium: true, window: true },
  '@kisaki3/extension-distribution': chromium,
}

/** Registers each public library through its shared verify and tarball consumer entry points. */
function libraryChecks(name: string): PackageChecks {
  const consumers = consumerEnvironments[name] ?? {}
  const tasks: Record<string, TaskEnvironment> = { verify: consumers, 'test:consumers': consumers }
  if (name === '@kisaki3/desktop-ui') {
    tasks['test:browser'] = chromium
  }
  return {
    defaultTask: 'verify',
    targets: ['linux-x64'],
    manualTargets: nativeTargets,
    tasks,
  }
}

/** Linux tools for building the desktop formats and observing their native windows. */
const linuxPackaging = ['wmctrl', 'libfuse2', 'rpm']

/** Playwright measurements retained after the desktop performance task succeeds. */
const performanceReport = 'test-results/performance/results.json'

/** Host and task registrations for packages with their own verification contracts. */
const packageChecks: Readonly<Record<string, PackageChecks>> = {
  '@kisaki3/tooling': {
    defaultTask: 'test',
    // Workspace checks run this same task on Linux x64.
    targets: nativeTargets.filter((target) => target !== 'linux-x64'),
    manualTargets: nativeTargets,
    tasks: { test: {} },
  },
  '@kisaki3/desktop': {
    defaultTask: 'verify',
    targets: nativeTargets,
    macosDeploymentTarget: '13.0',
    tasks: {
      verify: { chromium: true, window: true, linuxPackages: linuxPackaging, performanceReport },
      'verify:native': {},
      'test:window-startup': { window: true },
      'test:dev-session': { chromium: true, window: true, linuxPackages: ['wmctrl'] },
      'test:fixture-artifacts': { window: true, linuxPackages: linuxPackaging },
      'test:performance': { window: true, performanceReport },
    },
  },
}

/** Registers each package with target checks. Root checks cover the shared configuration itself. */
export function verificationPackages(workspace: readonly Project[]): VerificationPackage[] {
  return workspace.flatMap((project) => {
    if (!project.directory || project.name === '@kisaki3/config') {
      return []
    }
    const checks = project.directory.startsWith('clients/desktop/packages/')
      ? libraryChecks(project.name)
      : packageChecks[project.name]
    if (!checks) {
      throw new Error('No CI verification registered for ' + project.name)
    }
    return [{ ...project, ...checks }]
  })
}
