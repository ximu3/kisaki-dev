/**
 * @fileoverview Publishes complete candidate directories to project-owned outputs while
 * preserving the previous output on preparation failure.
 */

import { mkdir, mkdtemp, rename, rm, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

/**
 * Prepare a private candidate and replace one project-owned output after success.
 * Failure or cancellation before adoption preserves the previous output and removes the candidate.
 */
export async function replaceOutput<T>(
  project: string,
  output: string,
  prepare: (staging: string) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const destination = resolve(project, output)
  const child = relative(resolve(project), destination)
  if (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) {
    throw new Error('Output is outside its project')
  }
  signal?.throwIfAborted()

  await mkdir(dirname(destination), { recursive: true })
  const candidates = join(project, '.cache', 'output-staging')
  await mkdir(candidates, { recursive: true })
  const staging = await mkdtemp(join(candidates, `${basename(destination)}-`))
  const previous = `${staging}.previous`
  let movedPrevious = false
  try {
    const value = await prepare(staging)
    signal?.throwIfAborted()
    try {
      await stat(destination)
      await rename(destination, previous)
      movedPrevious = true
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
    }

    try {
      await rename(staging, destination)
    } catch (cause) {
      if (movedPrevious) await rename(previous, destination)
      throw cause
    }
    await rm(previous, { recursive: true, force: true })
    return value
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}
