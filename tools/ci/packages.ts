import type { Project } from '../workspace.ts'

export const runners = {
  'linux-x64': 'ubuntu-22.04',
  'linux-arm64': 'ubuntu-22.04-arm',
  'windows-x64': 'windows-2025',
  'windows-arm64': 'windows-11-arm',
  'macos-x64': 'macos-15-intel',
  'macos-arm64': 'macos-15',
} as const

type Target = keyof typeof runners

const nativeTargets = Object.keys(runners) as Target[]

interface TaskEnvironment {
  chromium?: boolean
  window?: boolean
  linuxPackages?: readonly string[]
  performanceReport?: string
}

interface PackageChecks {
  defaultTask: string
  targets: readonly Target[]
  linuxPackages?: readonly string[]
  manualTargets?: readonly Target[]
  tasks: Readonly<Record<string, TaskEnvironment>>
  macosDeploymentTarget?: string
}

export type VerificationPackage = Project & PackageChecks

const chromium = { chromium: true }

const consumerEnvironments: Readonly<Record<string, TaskEnvironment>> = {
  '@kisaki3/desktop-appearance': chromium,
  '@kisaki3/desktop-contracts': chromium,
  '@kisaki3/desktop-localization': chromium,
  '@kisaki3/desktop-rpc': { window: true },
  '@kisaki3/desktop-ui': { chromium: true, window: true },
  '@kisaki3/extension-distribution': chromium,
}

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

const linuxPackaging = ['wmctrl', 'libfuse2', 'rpm']

const linuxIntegration = ['xdg-utils', 'dbus-daemon', 'dunst']

const performanceReport = 'test-results/performance/results.json'

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
    linuxPackages: ['libfontconfig1-dev', 'libfreetype-dev'],
    macosDeploymentTarget: '13.0',
    tasks: {
      verify: {
        chromium: true,
        window: true,
        linuxPackages: [...linuxPackaging, ...linuxIntegration],
        performanceReport,
      },
      'verify:native': {},
      'test:window-startup': { window: true, linuxPackages: linuxIntegration },
      'test:dev-session': { chromium: true, window: true, linuxPackages: ['wmctrl'] },
      'test:candidate-artifacts': { window: true, linuxPackages: linuxPackaging },
      'test:performance': { window: true, performanceReport },
    },
  },
}

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
