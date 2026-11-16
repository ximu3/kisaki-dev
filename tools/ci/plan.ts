/** @fileoverview Plans GitHub Actions jobs from affected projects and their registered verification groups. */

import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { workspaceVerification } from './groups.ts'
import { selectGroups } from './projects.ts'

/** Creates one independent runner job per selected group and host, or only the requested diagnostic. */
export function planChecks(
  paths: readonly string[] | undefined,
  { workspace, groups }: ReturnType<typeof workspaceVerification>,
  requestedTarget = 'all',
  requestedSuite = 'all',
) {
  if (
    requestedTarget !== 'all' &&
    !groups.some((group) => Object.hasOwn(group.manualTargets ?? group.targets, requestedTarget))
  ) {
    throw new Error('Unknown host ' + requestedTarget)
  }
  if (
    requestedSuite !== 'all' &&
    !groups.some(
      (group) =>
        group.name === requestedSuite || Object.hasOwn(group.diagnostics ?? {}, requestedSuite),
    )
  ) {
    throw new Error('Unknown verification group or suite ' + requestedSuite)
  }

  const selection = selectGroups(paths, workspace, groups)
  const matrix = selection.groups.flatMap((group) => {
    const diagnostic = group.diagnostics?.[requestedSuite]
    if (requestedSuite !== 'all' && requestedSuite !== group.name && !diagnostic) {
      return []
    }
    let hosts = Object.entries(
      requestedTarget !== 'all' || requestedSuite !== 'all'
        ? (group.manualTargets ?? group.targets)
        : group.targets,
    )
    if (requestedTarget !== 'all') {
      hosts = hosts.filter(([target]) => target === requestedTarget)
    }

    const diagnostics = workspace
      .filter((project) => group.members.includes(project.name))
      .map((project) => project.directory + '/test-results/')
      .join('\n')
    return hosts.map(([target, runner]) => {
      const check = diagnostic ?? group.verify(target)
      const linux = target.startsWith('linux-')
      const x11 = linux && !!check.window
      return {
        group: group.name,
        label: [group.name, ...(diagnostic ? [requestedSuite] : []), target].join(' · '),
        target,
        runner,
        arch: target.split('-')[1]!,
        tasks: check.tasks,
        chromium: check.chromium,
        x11,
        systemPackages: [
          ...(x11 ? ['xvfb', 'openbox', 'wmctrl'] : []),
          ...(linux ? (check.linuxPackages ?? []) : []),
        ],
        performanceReport: check.performanceReport,
        diagnostics,
      }
    })
  })
  if (requestedSuite !== 'all' && !matrix.length) {
    throw new Error(`Suite ${requestedSuite} does not run on ${requestedTarget}`)
  }
  return { scope: selection.scope, code: selection.scope !== 'docs', matrix }
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
    workspaceVerification(),
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
        ...plan.matrix.map((row) => '- ' + row.label + ' · ' + row.tasks.join(', ')),
        '',
      ].join('\n'),
    )
  }
}
