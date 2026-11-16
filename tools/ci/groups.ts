/** @fileoverview Declares the current verification groups, their hosts and their local task entry points. */

import { listProjects } from './projects.ts'
import type { ProjectGroup } from './projects.ts'

/** Native runners for the six desktop targets. */
const desktopRunners = {
  'linux-x64': 'ubuntu-22.04',
  'linux-arm64': 'ubuntu-22.04-arm',
  'windows-x64': 'windows-2025',
  'windows-arm64': 'windows-11-arm',
  'macos-x64': 'macos-15-intel',
  'macos-arm64': 'macos-15',
} as const

/** Task roots, system facilities and optional measurements for a single runner. */
export interface Check {
  tasks: readonly string[]
  chromium?: string
  window?: boolean
  linuxPackages?: readonly string[]
  performanceReport?: string
}

/** One deliverable group's automatic verification and its available manual diagnostics. */
export interface VerificationGroup extends ProjectGroup {
  /** Automatic target identities and their Actions runner labels. */
  targets: Readonly<Record<string, string>>
  /** Wider supported host selection for explicit reproduction of a representative check. */
  manualTargets?: Readonly<Record<string, string>>
  /** Selects the complete project tasks needed on this host. */
  verify(target: string): Check
  diagnostics?: Readonly<Record<string, Check>>
}

/** Reads the candidate workspace and registers the verification contracts of its established projects. */
export function workspaceVerification() {
  const workspace = listProjects()
  const app = '@kisaki3/desktop'
  const ui = '@kisaki3/desktop-ui'
  const libraries = listProjects('./clients/desktop/packages/*')
    .map((project) => project.name)
    .sort()
  const libraryInputs = listProjects('{./clients/desktop/packages/*}...').map(
    (project) => project.name,
  )
  const desktopInputs = listProjects(app + '...').map((project) => project.name)
  const performanceReport = 'clients/desktop/app/test-results/performance/results.json'
  const linuxPackaging = ['libfuse2', 'rpm']

  const groups: VerificationGroup[] = [
    {
      name: 'public packages',
      members: libraries,
      inputs: [...libraryInputs, ...desktopInputs],
      targets: { 'linux-x64': desktopRunners['linux-x64'] },
      manualTargets: desktopRunners,
      /** All public tarballs and the UI browser suite share one independent feedback job. */
      verify: () => ({
        tasks: libraries.map((name) => name + '#verify'),
        chromium: ui,
        window: true,
      }),
      diagnostics: {
        browser: { tasks: [ui + '#test:browser'], chromium: ui },
        consumers: {
          tasks: libraries.map((name) => name + '#test:consumers'),
          chromium: ui,
          window: true,
        },
      },
    },
    {
      name: 'desktop',
      members: [app],
      inputs: desktopInputs,
      targets: desktopRunners,
      /** Linux x64 already runs the tooling tests in Workspace checks. Other hosts exercise their own processes. */
      verify(target) {
        const tasks = [app + '#verify']
        if (target !== 'linux-x64') {
          tasks.push('@kisaki3/tooling#test')
        }
        return {
          tasks,
          chromium: app,
          window: true,
          linuxPackages: linuxPackaging,
          performanceReport,
        }
      },
      diagnostics: {
        native: { tasks: [app + '#check:native', app + '#test:native'] },
        'window-startup': { tasks: [app + '#test:window-startup'], window: true },
        'dev-session': { tasks: [app + '#test:dev-session'], chromium: app, window: true },
        tooling: { tasks: ['@kisaki3/tooling#test'] },
        'fixture-artifacts': {
          tasks: [app + '#test:fixture-artifacts'],
          window: true,
          linuxPackages: linuxPackaging,
        },
        performance: { tasks: [app + '#test:performance'], window: true, performanceReport },
      },
    },
  ]
  return { workspace, groups }
}
