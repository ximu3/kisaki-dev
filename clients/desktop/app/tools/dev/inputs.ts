/**
 * @fileoverview Watches runtime and public-package inputs independently of renderer-server
 * restarts.
 */

import { once } from 'node:events'
import { readdir } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, sep } from 'node:path'
import { watch } from 'chokidar'
import type { FSWatcher } from 'chokidar'
import { appRoot, repositoryRoot } from '../lib/paths'
import type { DesktopDependency } from './dependencies'

/** Session callbacks receive changes and terminal watcher failures after initial readiness. */
interface InputWatchOptions {
  signal?: AbortSignal
  onChange(change: 'runtime' | 'public-package'): void
  onError(cause: unknown): void
}

function contains(parent: string, path: string): boolean {
  const child = relative(parent, path)
  return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

/** Keep documentation, verification and generated state outside the live production input set. */
function isDevelopmentInput(path: string): boolean {
  const name = basename(path)
  return (
    ![
      'node_modules',
      '.cache',
      '.turbo',
      '.local',
      '.vitest',
      'target',
      'dist',
      'out',
      'tests',
      'test-results',
      'playwright-report',
      'coverage',
      'vitest.config.ts',
      'playwright.config.ts',
      'eslint.config.ts',
      'tsconfig.tests.json',
    ].includes(name) &&
    !/\.md$|\.test\.tsx?$/.test(name) &&
    !/(?:^|[/\\])config[/\\](?:vitest|playwright)(?:[/\\]|$)/.test(path)
  )
}

/** Watch package production roots so additions are observed alongside existing source and configuration. */
async function publicPackageInputs(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = entries
    .filter(
      (entry) =>
        entry.isFile() && /\.(?:ts|json)$/.test(entry.name) && isDevelopmentInput(entry.name),
    )
    .map((entry) => entry.name)
    .sort()

  return ['src', 'tools', 'config', ...files].map((name) => join(directory, name))
}

/** Initialize all build inputs, closing on failure or cancellation; the session owns close() afterward. */
export async function startInputWatcher(
  members: DesktopDependency[],
  options: InputWatchOptions,
): Promise<FSWatcher> {
  options.signal?.throwIfAborted()

  const packageInputs = (
    await Promise.all(members.map((member) => publicPackageInputs(member.path)))
  ).flat()
  const runtimeInputs = [
    ...['main', 'preload', 'extension-host', 'shared'].map((name) => join(appRoot, 'src', name)),
    join(appRoot, 'native'),
    join(appRoot, 'assets'),
    ...['main', 'preload', 'extension-host', 'renderer'].map((name) =>
      join(appRoot, 'config', 'vite', `vite.config.${name}.ts`),
    ),
    join(appRoot, 'config', 'typescript'),
    join(appRoot, 'tsconfig.json'),
    join(appRoot, 'package.json'),
    join(repositoryRoot, 'pnpm-lock.yaml'),
  ]

  const watcher = watch([...packageInputs, ...runtimeInputs], {
    ignoreInitial: true,
    ignored: (path) => !isDevelopmentInput(path),
  })
  let initialized = false
  watcher.on('error', (cause) => {
    // once() rejects initialization errors; subsequent failures belong to the live session.
    if (initialized) options.onError(cause)
  })

  try {
    await once(watcher, 'ready', { signal: options.signal })
    initialized = true
    watcher.on('all', (_event, path) => {
      if (packageInputs.some((input) => contains(input, path))) {
        options.onChange('public-package')
      } else if (runtimeInputs.some((input) => contains(input, path))) {
        options.onChange('runtime')
      }
    })

    return watcher
  } catch (cause) {
    await watcher.close()
    throw cause
  }
}
