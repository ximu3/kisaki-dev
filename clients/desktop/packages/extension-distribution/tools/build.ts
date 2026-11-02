/** @fileoverview Builds every distribution entry and declaration before adopting the candidate. */

import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'tsdown'
import { runCli } from '@kisaki3/tooling/cli'
import { replaceOutput } from '@kisaki3/tooling/output'

/** Preserve the existing dist on preparation failure or cancellation before adoption. */
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCli(buildPackage)
}
