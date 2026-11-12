/** @fileoverview Test-only process entry that injects a failure after real command cancellation. */

import { isCancellation } from '../../src/errors'
import { runPnpm as runPnpmCommand } from '../../src/process'
import type { ProcessOptions } from '../../src/process'

export * from '../../src/process'

/** Runs the command to closure, then replaces its signal cancellation with a synthetic failure. */
export async function runPnpm(args: string[], options: ProcessOptions = {}): Promise<void> {
  try {
    await runPnpmCommand(args, options)
  } catch (cause) {
    if (options.signal && isCancellation(cause, options.signal)) {
      throw new Error('Synthetic command cancellation failure', { cause })
    }
    throw cause
  }
}
