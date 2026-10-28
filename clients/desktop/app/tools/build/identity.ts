/**
 * @fileoverview Reads desktop build input identities and inventories completed runtime bytes
 * for loading and packaging.
 */

import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { readPnpm } from '@kisaki3/tooling/process'
import { repositoryRoot } from '../lib/paths'
import { sha256 } from '../lib/sha256'

/** Read the locked Turbo build task's input identity, waiting for its query to close on cancellation. */
export async function buildInputIdentity(
  options: { root?: string; signal?: AbortSignal | undefined } = {},
): Promise<string> {
  const plan: unknown = JSON.parse(
    await readPnpm(
      [
        'exec',
        'turbo',
        'run',
        'build',
        '--filter=@kisaki3/desktop',
        '--dry=json',
        '--cwd',
        options.root ?? repositoryRoot,
      ],
      repositoryRoot,
      { signal: options.signal },
    ),
  )
  if (!plan || typeof plan !== 'object' || !('tasks' in plan) || !Array.isArray(plan.tasks)) {
    throw new Error('Turbo did not report desktop build tasks')
  }

  const tasks: unknown[] = plan.tasks
  for (const task of tasks) {
    if (
      task &&
      typeof task === 'object' &&
      'taskId' in task &&
      task.taskId === '@kisaki3/desktop#build'
    ) {
      if (!('hash' in task) || typeof task.hash !== 'string' || !task.hash) {
        throw new Error('Turbo reported an invalid desktop build input hash')
      }

      return task.hash
    }
  }

  throw new Error('Turbo did not report the desktop build task')
}

/** Record every runtime byte after all owners have completed their outputs. */
export async function runtimeFiles(directory: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {}

  /** Add each runtime file's digest, using paths relative to the build directory. */
  async function visit(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        await visit(path)
      } else {
        const name = relative(directory, path).replaceAll('\\', '/')
        if (name !== 'build.json') files[name] = sha256(await readFile(path))
      }
    }
  }

  await visit(directory)
  return files
}
