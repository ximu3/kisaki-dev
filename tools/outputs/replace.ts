import { mkdir, mkdtemp, rename, rm, stat } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { withOutputs } from './access'
import type { AccessOptions } from './access'

/**
 * Prepare a private directory and publish it under exclusive output access.
 * Preparation failure or cancellation preserves the previous output; owned staging is removed.
 */
export async function replaceOutput<T>(
  project: string,
  output: string,
  prepare: (staging: string) => Promise<T>,
  options: AccessOptions = {},
): Promise<T> {
  const destination = resolve(project, output)
  return withOutputs(
    [{ project, mode: 'use', write: [destination] }],
    async (signal) => {
      await mkdir(dirname(destination), { recursive: true })
      const candidates = join(project, '.cache', 'output-staging')
      await mkdir(candidates, { recursive: true })
      const staging = await mkdtemp(join(candidates, `${basename(destination)}-`))
      const previous = `${staging}.previous`
      let movedPrevious = false
      try {
        const value = await prepare(staging)
        signal.throwIfAborted()
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
    },
    options,
  )
}
