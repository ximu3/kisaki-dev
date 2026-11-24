import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { runners, verificationPackages, type VerificationPackage } from './packages.ts'
import { selectPackages, type PackageSelection } from './selection.ts'
import { listProjects, repositoryRoot } from '../workspace.ts'

export interface CheckRequest {
  package?: string | undefined
  task?: string | undefined
  target?: string | undefined
}

export function planChecks(
  selection: PackageSelection,
  packages: readonly VerificationPackage[],
  request: CheckRequest = {},
) {
  if (request.task && !request.package) {
    throw new Error('Select a workspace package for task ' + request.task)
  }
  const requestedTarget = request.target === 'all' ? undefined : request.target
  const manual = !!(request.package || requestedTarget)
  const names = new Set(selection.projects.map((project) => project.name))
  const selected = manual
    ? packages.filter((project) => !request.package || project.name === request.package)
    : packages.filter((project) => names.has(project.name))
  if (request.package && !selected.length) {
    throw new Error('No target checks registered for ' + request.package)
  }

  const matrix = selected.flatMap((project) => {
    const defaultTask = manual
      ? project.defaultTask
      : (project.automaticTask ?? project.defaultTask)
    const task = request.task || defaultTask
    if (!Object.hasOwn(project.tasks, task)) {
      throw new Error(
        `Unknown task ${project.name}#${task}. Available tasks: ${Object.keys(project.tasks).join(', ')}`,
      )
    }
    const environment = project.tasks[task]!
    const targets = manual ? (project.manualTargets ?? project.targets) : project.targets
    const hosts = requestedTarget ? targets.filter((target) => target === requestedTarget) : targets

    return hosts.map((target) => {
      const linux = target.startsWith('linux-')
      const x11 = linux && !!environment.window
      return {
        package: project.name,
        task: project.name + '#' + task,
        label: [project.name, ...(task === defaultTask ? [] : [task]), target].join(', '),
        target,
        runner: runners[target],
        arch: target.split('-')[1]!,
        chromium: environment.chromium,
        consumerNode: environment.consumerNode,
        x11,
        systemPackages: [
          ...(x11 ? ['xvfb', 'openbox'] : []),
          ...(linux ? (project.linuxPackages ?? []) : []),
          ...(linux ? (environment.linuxPackages ?? []) : []),
        ],
        macosDeploymentTarget: target.startsWith('macos-')
          ? project.macosDeploymentTarget
          : undefined,
        artifactName: encodeURIComponent(project.name) + '-' + target,
        performanceReport:
          environment.performanceReport && project.directory + '/' + environment.performanceReport,
        diagnostics: project.directory + '/test-results/',
      }
    })
  })
  if (requestedTarget && !matrix.length) {
    throw new Error(`No selected package runs on ${requestedTarget}`)
  }
  const scope = manual ? 'requested' : selection.scope
  return { scope, matrix }
}

function changedPaths(base: string | undefined, head: string): string[] | undefined {
  if (!base || /^0+$/.test(base) || process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    return undefined
  }
  try {
    execFileSync('git', ['cat-file', '-e', base + '^{commit}'], {
      cwd: repositoryRoot,
      stdio: 'ignore',
    })
  } catch {
    return undefined
  }
  return execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', base, head, '--'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean)
}

if (import.meta.main) {
  const [base, head = 'HEAD'] = process.argv.slice(2)
  const paths = changedPaths(base, head)
  const workspace = listProjects()
  const plan = planChecks(selectPackages(paths, workspace), verificationPackages(workspace), {
    package: process.env.REQUEST_PACKAGE,
    task: process.env.REQUEST_TASK,
    target: process.env.REQUEST_TARGET,
  })
  console.log(JSON.stringify({ base, head, paths, ...plan }, null, 2))

  if (process.env.GITHUB_OUTPUT) {
    for (const [key, value] of Object.entries({
      scope: plan.scope,
      selected: String(plan.matrix.length > 0),
      matrix: JSON.stringify(plan.matrix),
    })) {
      appendFileSync(process.env.GITHUB_OUTPUT, key + '=' + value + '\n')
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
        ...plan.matrix.map((row) => `- \`${row.task}\` on ${row.target}`),
        '',
      ].join('\n'),
    )
  }
}
