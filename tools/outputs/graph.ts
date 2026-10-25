import { readFile, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import { currentAccess, repositoryRoot, withOutputs } from './access'
import type { AccessOptions, OutputRequest } from './access'
import { readPnpm, runPnpm } from './process'

/** A real project selected by pnpm's workspace graph. */
export interface WorkspaceProject {
  name: string
  path: string
}

/** Read pnpm-selected members rather than maintaining an engineering dependency graph. */
export async function workspaceProjects(
  filter: string,
  options: AccessOptions = {},
): Promise<WorkspaceProject[]> {
  const root = options.root ?? currentAccess()?.root ?? repositoryRoot
  const value: unknown = JSON.parse(
    await readPnpm(
      ['list', '--filter', filter, '--depth', '-1', '--json'],
      root,
      options.signal ? { signal: options.signal } : {},
    ),
  )
  if (!Array.isArray(value)) throw new Error('Workspace projects are unavailable')
  const projects: WorkspaceProject[] = []
  for (const member of value) {
    if (
      !member ||
      typeof member !== 'object' ||
      !('name' in member) ||
      typeof member.name !== 'string' ||
      !('path' in member) ||
      typeof member.path !== 'string' ||
      !isAbsolute(member.path)
    ) {
      throw new Error('Invalid workspace project')
    }
    projects.push({ name: member.name, path: await realpath(member.path) })
  }
  return projects
}

/** Lock the built exports of actual workspace dependencies while a project consumes them. */
export async function dependencyRequests(
  project: string,
  options: AccessOptions = {},
): Promise<OutputRequest[]> {
  const owner = await realpath(project)
  const manifest: unknown = JSON.parse(await readFile(resolve(owner, 'package.json'), 'utf8'))
  if (
    !manifest ||
    typeof manifest !== 'object' ||
    !('name' in manifest) ||
    typeof manifest.name !== 'string'
  ) {
    throw new Error('Project identity is unavailable')
  }
  return (await workspaceProjects(`${manifest.name}^...`, options))
    .filter((member) => member.path !== owner)
    .map((member) => ({ project: member.path, mode: 'use', read: ['dist'] }))
}

/** Hold a project's declared outputs together with the dependency exports it consumes. */
export async function withProjectOutputs<T>(
  project: string,
  outputs: { read?: readonly string[]; write?: readonly string[] },
  action: (signal: AbortSignal) => Promise<T>,
  options: AccessOptions = {},
): Promise<T> {
  const dependencies = await dependencyRequests(project, options)
  return withOutputs([{ project, mode: 'use', ...outputs }, ...dependencies], action, options)
}

/** Convert a declared cache-output pattern to its owned directory, including missing outputs. */
function outputDirectory(pattern: string): string | undefined {
  if (pattern.startsWith('!')) return undefined
  const parts = pattern.replaceAll('\\', '/').split('/')
  const wildcard = parts.findIndex((part) => /[*?[\]{}()]/.test(part))
  const directory = wildcard < 0 ? dirname(pattern) : parts.slice(0, wildcard).join('/')
  if (!directory || directory === '.' || directory.includes('$') || isAbsolute(directory)) {
    throw new Error('Cached outputs must identify a project-owned directory')
  }
  return directory
}

/** Read Turbo's public execution plan before its cache restoration or task execution can write. */
export async function turboOutputRequests(
  args: readonly string[],
  options: AccessOptions = {},
): Promise<OutputRequest[]> {
  const root = options.root ?? currentAccess()?.root ?? repositoryRoot
  const planned = [...args]
  const forwarded = planned.indexOf('--')
  planned.splice(forwarded < 0 ? planned.length : forwarded, 0, '--dry=json')
  const value: unknown = JSON.parse(
    await readPnpm(
      ['exec', 'turbo', ...planned],
      root,
      options.signal ? { signal: options.signal } : {},
    ),
  )
  if (!value || typeof value !== 'object' || !('tasks' in value) || !Array.isArray(value.tasks)) {
    throw new Error('Turbo task plan is unavailable')
  }
  const requests: OutputRequest[] = []
  for (const task of value.tasks) {
    if (
      !task ||
      typeof task !== 'object' ||
      !('directory' in task) ||
      typeof task.directory !== 'string' ||
      !('task' in task) ||
      typeof task.task !== 'string' ||
      !('resolvedTaskDefinition' in task) ||
      !task.resolvedTaskDefinition ||
      typeof task.resolvedTaskDefinition !== 'object'
    ) {
      throw new Error('Invalid Turbo task plan')
    }
    const definition = task.resolvedTaskDefinition
    if (
      !('cache' in definition) ||
      typeof definition.cache !== 'boolean' ||
      !('persistent' in definition) ||
      typeof definition.persistent !== 'boolean' ||
      !('outputs' in definition) ||
      !Array.isArray(definition.outputs) ||
      !definition.outputs.every((output: unknown) => typeof output === 'string')
    ) {
      throw new Error('Invalid Turbo task outputs')
    }
    if (definition.persistent) {
      throw new Error('Persistent workflows must own their project lifetime')
    }
    const project = resolve(root, task.directory)
    if (task.task === 'clean') {
      requests.push({ project, mode: 'clean' })
    } else {
      const writes = definition.cache
        ? (definition.outputs as string[]).flatMap((pattern) => {
            const directory = outputDirectory(pattern)
            return directory ? [directory] : []
          })
        : []
      requests.push({ project, mode: 'use', write: writes })
    }
  }
  return requests
}

/** Hold a planned Turbo operation through any subsequent copy or consumer handoff. */
export async function withTurboOutputs<T>(
  args: readonly string[],
  action: (signal: AbortSignal) => Promise<T>,
  options: AccessOptions & { requests?: readonly OutputRequest[] } = {},
): Promise<T> {
  const requests = await turboOutputRequests(args, options)
  return withOutputs([...requests, ...(options.requests ?? [])], action, options)
}

/** Execute the same planned command under cache-output locks, preserving Turbo's task parallelism. */
export async function runTurbo(args: string[], options: AccessOptions = {}): Promise<void> {
  const root = options.root ?? currentAccess()?.root ?? repositoryRoot
  await withTurboOutputs(
    args,
    async () => {
      await runPnpm(['exec', 'turbo', ...args], { cwd: root })
    },
    options,
  )
}
