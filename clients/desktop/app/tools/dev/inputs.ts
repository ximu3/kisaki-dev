/**
 * @fileoverview Watches runtime and public-package inputs independently of renderer-server
 * restarts.
 */

import { once } from 'node:events'
import { isAbsolute, join, relative, sep } from 'node:path'
import { watch } from 'chokidar'
import type { FSWatcher } from 'chokidar'
import { appRoot, repositoryRoot } from '../lib/paths'
import { isPackageBuildInput, publicPackageBuildInputs } from '../lib/package-inputs'
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

/** Initialize all build inputs, closing on failure or cancellation; the session owns close() afterward. */
export async function startInputWatcher(
  members: DesktopDependency[],
  options: InputWatchOptions,
): Promise<FSWatcher> {
  options.signal?.throwIfAborted()
  const packageInputs = (
    await Promise.all(members.map((member) => publicPackageBuildInputs(member.path)))
  ).flat()
  const runtimeInputs = [
    ...['main', 'preload', 'extension-host', 'shared'].map((name) => join(appRoot, 'src', name)),
    join(appRoot, 'native'),
    join(appRoot, 'assets'),
    ...['main', 'preload', 'extension-host', 'renderer'].map((name) =>
      join(appRoot, 'config', 'vite', `vite.config.${name}.ts`),
    ),
    join(appRoot, 'package.json'),
    join(repositoryRoot, 'pnpm-lock.yaml'),
  ]

  const watcher = watch([...packageInputs, ...runtimeInputs], {
    ignoreInitial: true,
    ignored: (path) => !isPackageBuildInput(path),
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
