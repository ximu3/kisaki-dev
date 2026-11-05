/** @fileoverview Builds the desktop localization package before adopting its public outputs. */

import { join } from 'node:path'
import { build } from 'tsdown'
import { runCli } from '@kisaki3/tooling/cli'
import { replaceOutput } from '@kisaki3/tooling/output'
import { checkMessageTypes } from './generate-messages'

/** Preserve the previous distribution if any entry, declaration or candidate preparation fails. */
export async function buildPackage(signal?: AbortSignal): Promise<void> {
  const project = join(import.meta.dirname, '..')
  await checkMessageTypes()

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
