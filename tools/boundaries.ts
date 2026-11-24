import { readdir } from 'node:fs/promises'
import { runCli } from '@kisaki3/tooling/cli'
import { runPnpm } from '@kisaki3/tooling/process'
import { listProjects, repositoryRoot } from './workspace.ts'

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
  await runPnpm(['exec', 'depcruise', ...inputs], {
    cwd: repositoryRoot,
    signal,
  })
}

if (import.meta.main) {
  await runCli((signal) => checkBoundaries(process.argv[2], signal))
}
