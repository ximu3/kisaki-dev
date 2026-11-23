import { once } from 'node:events'
import { basename, join } from 'node:path'
import { watch, type FSWatcher } from 'chokidar'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'
import { programNames } from '../build/programs'
import { appRoot, containsPath, repositoryRoot } from '../lib/paths'

export type PreparationChange = 'native' | 'resources' | 'configuration'

interface InputWatchOptions {
  /** Watches rebuildable native and resource inputs when the session owns them. */
  watchAssets: boolean
  /** Cancels initialization; the session owns closure after readiness. */
  signal?: AbortSignal

  onChange(change: PreparationChange): void
  /** Delivers a post-readiness watcher failure to the owning session. */
  onError(cause: unknown): void
}

function isDevelopmentInput(path: string): boolean {
  const name = basename(path)
  return (
    ![
      'node_modules',
      '.cache',
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
      'tsconfig.tests.json',
    ].includes(name) &&
    !/\.md$|\.test\.tsx?$/.test(name) &&
    !/(?:^|[/\\])config[/\\](?:vitest|playwright)(?:[/\\]|$)/.test(path)
  )
}

/**
 * Watches native resources and program configuration outside the compiler graph.
 *
 * Waits for initial readiness before delivering changes. Startup failure or cancellation closes the
 * watcher before rejection; after success the session owns close().
 */
export async function startInputWatcher(
  sourceRoot: string,
  options: InputWatchOptions,
): Promise<FSWatcher> {
  options.signal?.throwIfAborted()

  const { watchAssets } = options
  const native = join(appRoot, 'native')
  const resources = [join(appRoot, 'assets'), join(appRoot, 'drizzle')]
  const configuration = [
    ...programNames.map((name) => join(sourceRoot, 'config', 'vite', `${name}.ts`)),
    join(appRoot, 'config', 'typescript'),
    join(appRoot, 'tsconfig.json'),
    join(appRoot, 'package.json'),
    join(repositoryRoot, 'pnpm-lock.yaml'),
  ]
  const watched = watchAssets ? [native, ...resources, ...configuration] : configuration

  const watcher = watch(watched, {
    ignoreInitial: true,
    ignored: (path) => !isDevelopmentInput(path),
  })
  let initialized = false
  watcher.on('error', (cause) => {
    // once() rejects initialization errors; subsequent failures belong to the live session.
    if (initialized) {
      options.onError(cause)
    }
  })

  try {
    await once(watcher, 'ready', { signal: options.signal })
    initialized = true
    watcher.on('all', (_event, path) => {
      if (watchAssets && containsPath(native, path)) {
        options.onChange('native')
      } else if (watchAssets && resources.some((root) => containsPath(root, path))) {
        options.onChange('resources')
      } else if (configuration.some((root) => containsPath(root, path))) {
        options.onChange('configuration')
      }
    })

    return watcher
  } catch (cause) {
    return rethrowAfterCleanup(
      cause,
      () => watcher.close(),
      'Input watcher startup and cleanup failed',
    )
  }
}
