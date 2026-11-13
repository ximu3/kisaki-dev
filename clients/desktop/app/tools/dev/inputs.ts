/**
 * @fileoverview Watches preparation and configuration inputs outside the program compiler graph.
 */

import { once } from 'node:events'
import { readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { watch } from 'chokidar'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'
import type { FSWatcher } from 'chokidar'
import { appRoot, containsPath, repositoryRoot } from '../lib/paths'
import type { DesktopDependency } from './dependencies'

/** Preparation work selected by a non-program input change. */
export type PreparationChange = 'packages' | 'native' | 'resources' | 'configuration'

/** Session callbacks and initialization cancellation for preparation input watching. */
interface InputWatchOptions {
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

/**
 * Collects production roots and eligible root-level configuration files to watch for one package.
 */
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

/**
 * Watches package builds, native resources and program configuration.
 *
 * Waits for initial readiness before delivering changes. Startup failure or cancellation closes the
 * watcher before rejection; after success the session owns close().
 */
export async function startInputWatcher(
  sourceRoot: string,
  members: DesktopDependency[],
  options: InputWatchOptions,
): Promise<FSWatcher> {
  options.signal?.throwIfAborted()

  const packageInputs = (
    await Promise.all(members.map((member) => publicPackageInputs(member.path)))
  ).flat()
  const runtimeInputs = [
    join(appRoot, 'native'),
    join(appRoot, 'assets'),
    ...['main', 'preload', 'extension-host', 'renderer'].map((name) =>
      join(sourceRoot, 'config', 'vite', `vite.config.${name}.ts`),
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
    if (initialized) {
      options.onError(cause)
    }
  })

  try {
    await once(watcher, 'ready', { signal: options.signal })
    initialized = true
    watcher.on('all', (_event, path) => {
      if (packageInputs.some((input) => containsPath(input, path))) {
        options.onChange('packages')
      } else if (containsPath(join(appRoot, 'native'), path)) {
        options.onChange('native')
      } else if (containsPath(join(appRoot, 'assets'), path)) {
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
