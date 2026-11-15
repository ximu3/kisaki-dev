/** @fileoverview Runs shared dependency rules against the source scope owned by one project. */

import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { runCli } from '@kisaki3/tooling/cli'
import { runPnpm } from '@kisaki3/tooling/process'

/** Checkout root resolved from this engineering entry for dependency-boundary inspection. */
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))

/**
 * Checks an explicit workspace project or the repository-owned tools, tests and configuration.
 *
 * Package builds provide the public exports before the workspace graph is checked.
 */
export async function checkBoundaries(project?: string, signal?: AbortSignal): Promise<void> {
  const inputs = project
    ? [project]
    : [
        'clients/desktop/app',
        'clients/desktop/packages',
        'packages',
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
