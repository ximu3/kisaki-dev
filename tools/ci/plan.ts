/** @fileoverview Selects repository checks and host-specific scenarios from the complete candidate diff. */

import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Supported native runner identities and their Actions labels. */
const runners = {
  'linux-x64': 'ubuntu-22.04',
  'linux-arm64': 'ubuntu-22.04-arm',
  'windows-x64': 'windows-2025',
  'windows-arm64': 'windows-11-arm',
  'macos-x64': 'macos-15-intel',
  'macos-arm64': 'macos-15',
} as const

/** Validation actions implemented by the repository and its desktop projects. */
const suites = [
  'browser',
  'consumers',
  'native',
  'windows',
  'dev',
  'process',
  'artifacts',
  'performance',
] as const

/** Scenario dispatched to a runner. */
type Suite = (typeof suites)[number]

/** Platform and architecture selected as a single native host. */
type Target = keyof typeof runners

/** All supported runner identities in deterministic reporting order. */
const targets = Object.keys(runners) as Target[]

/** Reads the workspace package dependency edges that affect external tarball consumers. */
function publicPackages() {
  const root = 'clients/desktop/packages'
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => {
      const pkg = JSON.parse(readFileSync(join(root, name, 'package.json'), 'utf8')) as {
        name: string
        dependencies?: Record<string, string>
      }
      return { name: pkg.name, directory: name, dependencies: Object.keys(pkg.dependencies ?? {}) }
    })
}

/** Forms the union of the required suites and transitive public consumers for added and removed paths. */
export function planChecks(
  paths: readonly string[],
  full = false,
  requestedTarget = 'all',
  requestedSuite = 'all',
) {
  const packages = publicPackages()
  const consumers = new Set<string>()
  const changedPackages = new Set<string>()
  const rows = new Map<Target, Set<Suite>>()
  const reasons = new Set<string>()
  const code =
    full || paths.some((file) => !file.endsWith('.md') || file.includes('/release-notes/'))
  let installers = false

  /** Assigns the selected scenarios to hosts and records their reason once. */
  function add(reason: string, checks: readonly Suite[], hosts: readonly Target[] = ['linux-x64']) {
    reasons.add(reason)
    for (const host of hosts) {
      const selected = rows.get(host) ?? new Set<Suite>()
      for (const check of checks) {
        selected.add(check)
      }
      rows.set(host, selected)
    }
  }

  /** Expands a shared ABI or unknown runtime change to its complete compatibility surface. */
  function compatibility(reason: string) {
    for (const pkg of packages) {
      consumers.add(pkg.name)
    }
    add(reason, ['browser', 'consumers'])
    add(reason, ['process', 'native', 'windows', 'dev', 'artifacts'], targets)
  }

  if (full) {
    compatibility('Full compatibility requested or no usable Git baseline')
    add('Complete storage workload', ['performance'])
    installers = true
  } else {
    for (const file of paths.filter(
      (path) => !path.endsWith('.md') || path.includes('/release-notes/'),
    )) {
      const member = packages.find((pkg) =>
        file.startsWith('clients/desktop/packages/' + pkg.directory + '/'),
      )
      if (member) {
        if (file.includes('/tests/browser/')) {
          add('Browser interaction scenarios', ['browser'])
        } else {
          consumers.add(member.name)
          if (!file.includes('/tests/')) {
            changedPackages.add(member.name)
          }
          add('Public package or consumer changed', ['consumers'])
          if (member.directory === 'desktop-ui' || member.directory === 'desktop-appearance') {
            add('Rendered appearance and controls', ['browser'])
          }
        }
      } else if (file.startsWith('clients/desktop/app/')) {
        const part = file.slice('clients/desktop/app/'.length)
        if (
          /^(?:native\/|package\.json|vite\.config\.ts|tools\/native\/|config\/vitest\/vitest\.config\.native)/.test(
            part,
          )
        ) {
          add(
            'Native ABI, host or command contract',
            ['native', 'windows', 'dev', 'artifacts'],
            targets,
          )
        } else if (
          /^(?:drizzle\/|src\/main\/(?:infrastructure\/database|features\/preferences)|tests\/integration\/database)/.test(
            part,
          )
        ) {
          add('Database and migration behavior', ['native'])
          if (/name-order|connection|initialize|drizzle\/|executor/.test(part)) {
            add('Storage workload and system durability', ['performance'])
            add('Native SQLite driver', ['native'], ['macos-arm64', 'windows-x64'])
          }
        } else if (/^(?:tools\/package|electron-builder|tests\/artifacts)/.test(part)) {
          add('Desktop packaging and external artifact', ['artifacts'], targets)
          installers = true
        } else if (/^(?:tools\/dev|tests\/tools\/dev)/.test(part)) {
          add('Source rebuild and lifecycle', ['dev'], ['linux-x64', 'macos-x64', 'windows-x64'])
        } else if (
          part.includes('performance') ||
          part.includes('/measurement') ||
          part.includes('/workload')
        ) {
          add('Performance workload', ['performance'])
        } else if (
          /^(?:tests\/integration\/(?:files|native)|src\/main\/infrastructure\/files)/.test(part)
        ) {
          add(
            'Filesystem behavior on each OS',
            ['native'],
            ['linux-x64', 'macos-arm64', 'windows-x64'],
          )
        } else if (part.startsWith('src/renderer/')) {
          add('Desktop renderer and window', ['windows'])
        } else {
          add(
            'Desktop build, resources or runtime entry',
            ['native', 'windows', 'dev', 'artifacts'],
            ['linux-x64', 'macos-x64', 'windows-x64'],
          )
        }
      } else if (file.startsWith('packages/tooling/src/process/')) {
        let hosts: readonly Target[] = targets
        if (file.endsWith('/windows.ts')) {
          hosts = targets.filter((host) => host.startsWith('windows-'))
        } else if (file.endsWith('/unix.ts')) {
          hosts = ['linux-x64', 'macos-arm64']
        }
        add('Owned subprocess cancellation', ['process', 'dev'], hosts)
      } else if (file.startsWith('packages/tooling/src/testing/') || file === '.pnpmfile.mjs') {
        for (const pkg of packages) {
          consumers.add(pkg.name)
        }
        add('Packed installation and manifest', ['consumers'])
      } else if (
        /^(?:tests\/workspace\/|tools\/boundaries\.ts|\.dependency-cruiser\.json|\.gitignore|\.gitattributes|LICENSE$|\.github\/workflows\/pr-title\.yml)/.test(
          file,
        )
      ) {
        reasons.add('Repository checks')
      } else {
        compatibility('Shared tooling, workflow or unclassified input')
      }
    }
  }
  for (let previous = -1; previous !== changedPackages.size;) {
    previous = changedPackages.size
    for (const pkg of packages) {
      if (pkg.dependencies.some((name) => changedPackages.has(name))) {
        changedPackages.add(pkg.name)
        consumers.add(pkg.name)
      }
    }
  }

  if (requestedTarget !== 'all' && !targets.includes(requestedTarget as Target)) {
    throw new Error('Unknown host ' + requestedTarget)
  }
  if (requestedSuite !== 'all' && !suites.includes(requestedSuite as Suite)) {
    throw new Error('Unknown suite ' + requestedSuite)
  }
  const hosts = requestedTarget === 'all' ? targets : [requestedTarget as Target]
  const matrix = hosts.flatMap((target) => {
    let selected = [...(rows.get(target) ?? [])]
    if (full && (requestedSuite !== 'all' || requestedTarget !== 'all')) {
      selected = requestedSuite === 'all' ? [...suites] : [requestedSuite as Suite]
    }
    if (!selected.length) {
      return []
    }
    return [
      {
        target,
        runner: runners[target],
        arch: target.split('-')[1]!,
        suites: selected,
        label: selected.join(', '),
        packages: [...consumers].sort(),
      },
    ]
  })
  return {
    code,
    matrix,
    reasons: [...reasons],
    installers,
  }
}

if (import.meta.main) {
  const [base, head = 'HEAD'] = process.argv.slice(2)
  const full = !base || /^0+$/.test(base) || process.env.GITHUB_EVENT_NAME === 'workflow_dispatch'
  let hasBase = !full
  if (hasBase) {
    try {
      execFileSync('git', ['cat-file', '-e', base + '^{commit}'], { stdio: 'ignore' })
    } catch {
      hasBase = false
    }
  }
  const paths = hasBase
    ? execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', base!, head, '--'], {
        encoding: 'utf8',
      })
        .split('\0')
        .filter(Boolean)
    : []
  const plan = planChecks(
    paths,
    !hasBase,
    process.env.REQUEST_TARGET || 'all',
    process.env.REQUEST_SUITE || 'all',
  )
  console.log(JSON.stringify({ base, head, paths, ...plan }, null, 2))
  if (process.env.GITHUB_OUTPUT) {
    for (const [key, value] of Object.entries({
      code: plan.code,
      selected: plan.matrix.length > 0,
      matrix: plan.matrix,
      installers: plan.installers,
    })) {
      appendFileSync(process.env.GITHUB_OUTPUT, key + '=' + JSON.stringify(value) + '\n')
    }
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        '## Verification plan',
        ...plan.reasons.map((reason) => '- ' + reason),
        '',
        ...plan.matrix.map((row) => '- ' + row.target + ' · ' + row.label),
        '',
      ].join('\n'),
    )
  }
}
