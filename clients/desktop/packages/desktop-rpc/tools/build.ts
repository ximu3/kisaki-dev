/** @fileoverview Builds the public RPC entry and declarations before adopting the candidate. */

import { join } from 'node:path'
import { build } from 'tsdown'
import { runCli } from '@kisaki3/tooling/cli'
import { replaceOutput } from '@kisaki3/tooling/output'

/**
 * Builds the public RPC entry and declarations, then adopts the complete distribution.
 *
 * Failed preparation or cancellation before handoff preserves the existing dist directory.
 */
export async function buildPackage(signal?: AbortSignal): Promise<void> {
  const project = join(import.meta.dirname, '..')

  await replaceOutput(
    project,
    'dist',
    async (outDir) => {
      await build({ cwd: project, outDir })
    },
    signal,
  )
}

if (import.meta.main) {
  await runCli(buildPackage)
}
