/** @fileoverview Builds the desktop localization package before adopting its public outputs. */

import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCli(buildPackage)
}
