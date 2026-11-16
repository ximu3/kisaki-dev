/** @fileoverview Selects complete project verification and the native hosts that execute it. */

import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { relative, sep } from 'node:path'

/** Actions runner for each supported desktop target. */
const runners = {
  'linux-x64': 'ubuntu-22.04',
  'linux-arm64': 'ubuntu-22.04-arm',
  'windows-x64': 'windows-2025',
  'windows-arm64': 'windows-11-arm',
  'macos-x64': 'macos-15-intel',
  'macos-arm64': 'macos-15',
} as const

/** Name and project root reported by pnpm without installing workspace dependencies. */
interface Project {
  name: string
  path: string
}

/** Reads the projects selected by pnpm's workspace and dependency filters. */
function listProjects(filter: string): Project[] {
  const pnpm = process.env.npm_execpath
  if (!pnpm) {
    throw new Error('Run the verification planner through pnpm')
  }
  const output = execFileSync(
    pnpm,
    ['--filter', filter, '--fail-if-no-match', 'list', '--depth', '-1', '--json'],
    {
      encoding: 'utf8',
    },
  )
  return JSON.parse(output) as Project[]
}

/** Public projects and the ones whose changes can be verified without the desktop application. */
export function verificationProjects() {
  const libraries = listProjects('./clients/desktop/packages/*')
  const desktopInputs = new Set(listProjects('@kisaki3/desktop...').map((project) => project.name))
  return {
    libraries: libraries.map((project) => project.name).sort(),
    independentRoots: libraries
      .filter((project) => !desktopInputs.has(project.name))
      .map((project) => relative('.', project.path).split(sep).join('/') + '/'),
  }
}

/** Classifies the complete diff at project boundaries. Missing baselines require every host. */
function verificationScope(
  paths: readonly string[] | undefined,
  independentRoots: readonly string[],
) {
  if (!paths) {
    return 'desktop'
  }
  const inputs = paths.filter((path) => !/^(?:[^/]+|refactor\/.+)\.md$/.test(path))
  if (!inputs.length) {
    return 'docs'
  }
  return inputs.every((file) => independentRoots.some((root) => file.startsWith(root)))
    ? 'libraries'
    : 'desktop'
}

/** Local task roots and system facilities required by a verification group or manual suite. */
interface Check {
  tasks: string[]
  chromium?: string
  window?: boolean
  packaging?: boolean
}

/** Maps project-owned verification and individual diagnostic suites to their runner prerequisites. */
function verificationChecks(libraries: readonly string[]) {
  const app = '@kisaki3/desktop'
  const ui = '@kisaki3/desktop-ui'
  return {
    libraries: { tasks: libraries.map((name) => name + '#verify'), chromium: ui, window: true },
    desktop: { tasks: [app + '#verify'], chromium: app, window: true, packaging: true },
    browser: { tasks: [ui + '#test:browser'], chromium: ui },
    consumers: {
      tasks: libraries.map((name) => name + '#test:consumers'),
      chromium: ui,
      window: true,
    },
    native: { tasks: [app + '#check:native', app + '#test:native'] },
    'window-startup': { tasks: [app + '#test:window-startup'], window: true },
    'dev-session': { tasks: [app + '#test:dev-session'], chromium: app, window: true },
    tooling: { tasks: ['@kisaki3/tooling#test'] },
    'fixture-artifacts': {
      tasks: [app + '#test:fixture-artifacts'],
      window: true,
      packaging: true,
    },
    performance: { tasks: [app + '#test:performance'], window: true },
  } satisfies Record<string, Check>
}

/** Builds the automatic host matrix or runs an explicitly requested suite on its selected hosts. */
export function planChecks(
  paths: readonly string[] | undefined,
  projects: ReturnType<typeof verificationProjects>,
  requestedTarget = 'all',
  requestedSuite = 'all',
) {
  if (requestedTarget !== 'all' && !Object.hasOwn(runners, requestedTarget)) {
    throw new Error('Unknown host ' + requestedTarget)
  }
  const checks = verificationChecks(projects.libraries)
  if (requestedSuite !== 'all' && !Object.hasOwn(checks, requestedSuite)) {
    throw new Error('Unknown suite ' + requestedSuite)
  }

  const scope = verificationScope(paths, projects.independentRoots)
  const matrix = Object.entries(runners).flatMap(([target, runner]) => {
    if (scope === 'docs' || (requestedTarget !== 'all' && target !== requestedTarget)) {
      return []
    }
    const groups: (keyof typeof checks)[][] = []
    if (requestedSuite !== 'all') {
      groups.push([requestedSuite as keyof typeof checks])
    } else {
      if (target === 'linux-x64' || requestedTarget !== 'all') {
        groups.push(['libraries'])
      }
      if (scope === 'desktop') {
        // The Linux x64 workspace check already runs the private tooling suite on this host.
        groups.push(target === 'linux-x64' ? ['desktop'] : ['desktop', 'tooling'])
      }
    }

    return groups.map((selected) => {
      const requirements: Check[] = selected.map((name) => checks[name])
      const label = selected.includes('libraries') ? 'Public package checks' : 'Target checks'
      return {
        name: `${label} (${target})`,
        target,
        runner,
        arch: target.split('-')[1]!,
        checks: selected,
        tasks: requirements.flatMap((check) => check.tasks),
        chromium: requirements.find((check) => check.chromium)?.chromium,
        x11: target.startsWith('linux-') && requirements.some((check) => check.window),
        packaging: requirements.some((check) => check.packaging),
      }
    })
  })
  return { scope, code: scope !== 'docs', matrix }
}

/** Gets both sides of moves and deletions, or requests full verification without a usable baseline. */
function changedPaths(base: string | undefined, head: string): string[] | undefined {
  if (!base || /^0+$/.test(base) || process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    return undefined
  }
  try {
    execFileSync('git', ['cat-file', '-e', base + '^{commit}'], { stdio: 'ignore' })
  } catch {
    return undefined
  }
  return execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', base, head, '--'], {
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean)
}

if (import.meta.main) {
  const [base, head = 'HEAD'] = process.argv.slice(2)
  const paths = changedPaths(base, head)
  const plan = planChecks(
    paths,
    verificationProjects(),
    process.env.REQUEST_TARGET || 'all',
    process.env.REQUEST_SUITE || 'all',
  )
  console.log(JSON.stringify({ base, head, paths, ...plan }, null, 2))

  if (process.env.GITHUB_OUTPUT) {
    for (const [key, value] of Object.entries({
      code: plan.code,
      selected: plan.matrix.length > 0,
      matrix: plan.matrix,
    })) {
      appendFileSync(process.env.GITHUB_OUTPUT, key + '=' + JSON.stringify(value) + '\n')
    }
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        '## Verification plan',
        '',
        'Scope: ' + plan.scope,
        '',
        ...plan.matrix.map((row) => '- ' + row.target + ' · ' + row.checks.join(', ')),
        '',
      ].join('\n'),
    )
  }
}
