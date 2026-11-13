/** @fileoverview Test-only process entry that injects a failure after real command cancellation. */

import { runPnpm as runPnpmCommand } from '../../src/process'
import type { ProcessOptions } from '../../src/process'

export * from '../../src/process'

/**
 * Runs the command to closure, then injects a failure after cancellation is requested.
 *
 * The cause retains the command's outcome, including a real termination failure.
 */
export async function runPnpm(args: string[], options: ProcessOptions = {}): Promise<void> {
  try {
    await runPnpmCommand(args, options)
  } catch (cause) {
    if (options.signal?.aborted) {
      throw new Error('Synthetic command cancellation failure', { cause })
    }
    throw cause
  }
}
