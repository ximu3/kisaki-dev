/** @fileoverview Runs shared dependency rules against the source scope owned by one project. */

import { readdir } from 'node:fs/promises'
import { runCli } from '@kisaki3/tooling/cli'
import { runPnpm } from '@kisaki3/tooling/process'
import { listProjects, repositoryRoot } from './workspace.ts'

/**
 * Checks one explicit project, or all workspace members and repository-owned tools and configuration.
 *
 * Package builds provide the public exports before the workspace graph is checked.
 */
export async function checkBoundaries(project?: string, signal?: AbortSignal): Promise<void> {
  const inputs = project
    ? [project]
    : [
        ...listProjects()
          .map((project) => project.directory)
          .filter(Boolean),
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
