/** @fileoverview Runs shared dependency rules against the source scope owned by one project. */

import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { runCli } from '@kisaki3/tooling/cli'
import { runPnpm } from '@kisaki3/tooling/process'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))

/**
 * Checks an explicit workspace project or the repository-owned tools, tests and configuration.
 *
 * The owning Turbo task prepares its public dependencies before this read-only check runs.
 */
export async function checkBoundaries(project?: string, signal?: AbortSignal): Promise<void> {
  const inputs = project
    ? [project]
    : [
        'tools',
        'tests',
        'config',
        ...(await readdir(repositoryRoot, { withFileTypes: true }))
          .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
          .map((entry) => entry.name),
      ]
  await runPnpm(['exec', 'depcruise', '--config', '.dependency-cruiser.json', ...inputs], {
    cwd: repositoryRoot,
    signal,
  })
}

if (import.meta.main) {
  await runCli((signal) => checkBoundaries(process.argv[2], signal))
}
