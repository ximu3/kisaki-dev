/** @fileoverview Builds the complete desktop contract package before adopting its public outputs. */

import { join } from 'node:path'
import { build } from 'tsdown'
import { runCli } from '@kisaki3/tooling/cli'
import { replaceOutput } from '@kisaki3/tooling/output'
import { checkIconNames } from './generate-icon-names'

/**
 * Builds package entries and declarations before adopting the candidate distribution.
 *
 * Failure during preparation preserves the previous distribution.
 */
export async function buildPackage(signal?: AbortSignal): Promise<void> {
  const project = join(import.meta.dirname, '..')
  await checkIconNames()

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
