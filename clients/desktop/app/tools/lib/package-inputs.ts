/**
 * @fileoverview Selects production package inputs shared by desktop build identities and
 * development watching.
 */

import { readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'

/** Exclude verification-only files from package builds and live change notifications. */
export function isPackageBuildInput(path: string): boolean {
  const name = basename(path)
  return (
    ![
      'vitest.config.ts',
      'playwright.config.ts',
      'eslint.config.ts',
      'tsconfig.tests.json',
    ].includes(name) &&
    !/\.test\.tsx?$/.test(name) &&
    !/(?:^|[/\\])config[/\\](?:vitest|playwright)(?:[/\\]|$)/.test(path)
  )
}

/** Select input roots; the shared predicate also filters nested files and future watcher additions. */
export async function publicPackageBuildInputs(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = entries
    .filter(
      (entry) =>
        entry.isFile() && /\.(?:ts|json)$/.test(entry.name) && isPackageBuildInput(entry.name),
    )
    .map((entry) => entry.name)
    .sort()

  return ['src', 'tools', 'config', ...files].map((name) => join(directory, name))
}
