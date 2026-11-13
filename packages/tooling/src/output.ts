/**
 * @fileoverview Removes declared, reproducible outputs within their owning projects.
 */

import { rm } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

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
