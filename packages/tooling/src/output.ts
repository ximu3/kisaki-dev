/**
 * @fileoverview Manages declared project outputs, including candidate handoff and cleanup.
 */

import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

/** Resolves an output to a strict descendant of its owning project. */
function projectOutput(project: string, output: string): string {
  const destination = resolve(project, output)
  const child = relative(resolve(project), destination)
  if (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) {
    throw new Error('Output is outside its project')
  }

  return destination
}

/**
 * Removes declared project outputs in the supplied order.
 *
 * The caller stops active writers first. Cancellation is checked before each removal; completed
 * removals remain applied.
 */
export async function removeOutputs(
  project: string,
  outputs: readonly string[],
  signal?: AbortSignal,
): Promise<void> {
  for (const output of outputs) {
    signal?.throwIfAborted()
    await rm(projectOutput(project, output), { recursive: true, force: true })
  }
}

/**
 * Builds a private candidate and adopts it as one project output.
 *
 * Preparation failure or cancellation observed before handoff preserves the previous output. Failed
 * adoption attempts to restore that output. If restoration fails, its temporary backup is retained
 * and both failures are reported.
 *
 * Returns the prepared value after adoption and old-output cleanup. Cleanup failures reject the
 * operation.
 */
export async function replaceOutput<T>(
  project: string,
  output: string,
  prepare: (staging: string) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const destination = projectOutput(project, output)
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
      await rename(destination, previous)
      movedPrevious = true
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw cause
      }
    }

    try {
      await rename(staging, destination)
    } catch (cause) {
      if (movedPrevious) {
        try {
          await rename(previous, destination)
        } catch (rollbackFailure) {
          throw new AggregateError(
            [cause, rollbackFailure],
            'Output adoption and rollback failed',
            {
              cause: rollbackFailure,
            },
          )
        }
      }
      throw cause
    }

    await rm(previous, { recursive: true, force: true })

    return value
  } catch (cause) {
    try {
      await rm(staging, { recursive: true, force: true })
    } catch (cleanupFailure) {
      throw new AggregateError([cause, cleanupFailure], 'Output operation and cleanup failed', {
        cause: cleanupFailure,
      })
    }

    throw cause
  }
}
