/**
 * @fileoverview Watches preparation and configuration inputs outside the program compiler graph.
 */

import { once } from 'node:events'
import { basename, join } from 'node:path'
import { watch } from 'chokidar'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'
import type { FSWatcher } from 'chokidar'
import { appRoot, containsPath, repositoryRoot } from '../lib/paths'

/** Preparation work selected by a non-program input change. */
export type PreparationChange = 'native' | 'resources' | 'configuration'

/** Session callbacks and initialization cancellation for preparation input watching. */
interface InputWatchOptions {
  /** Watches rebuildable native and resource inputs when the session owns them. */
  watchAssets: boolean

  /** Cancels initialization; the session owns closure after readiness. */
  signal?: AbortSignal

  /** Selects the owning preparation workflow for a changed input. */
  onChange(change: PreparationChange): void

  /** Delivers a post-readiness watcher failure to the owning session. */
  onError(cause: unknown): void
}

/** Recognizes live production inputs while excluding documentation, tests and generated state. */
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

  const runtimeInputs = [
    ...(options.watchAssets
      ? ['native', 'assets', 'drizzle'].map((name) => join(appRoot, name))
      : []),
    ...['main', 'preload', 'extension-host', 'renderer'].map((name) =>
      join(sourceRoot, 'config', 'vite', `vite.config.${name}.ts`),
    ),
    join(appRoot, 'config', 'typescript'),
    join(appRoot, 'tsconfig.json'),
    join(appRoot, 'package.json'),
    join(repositoryRoot, 'pnpm-lock.yaml'),
  ]

  const watcher = watch(runtimeInputs, {
    ignoreInitial: true,

    /** Excludes inputs that do not belong to live development preparation. */
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
      if (containsPath(join(appRoot, 'native'), path)) {
        options.onChange('native')
      } else if (
        containsPath(join(appRoot, 'assets'), path) ||
        containsPath(join(appRoot, 'drizzle'), path)
      ) {
        options.onChange('resources')
      } else if (runtimeInputs.some((input) => containsPath(input, path))) {
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
