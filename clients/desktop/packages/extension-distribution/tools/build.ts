/**
 * @fileoverview Builds complete extension-distribution code and declarations before
 * replacing the package output.
 */

import { build } from 'tsdown'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { replaceOutput } from '@kisaki3/tooling/output'
import { runCli } from '@kisaki3/tooling/cli'

const root = fileURLToPath(new URL('..', import.meta.url))

/** Build complete code and declarations before replacing the package output. */
export async function buildPackage(signal?: AbortSignal): Promise<void> {
  await replaceOutput(
    root,
    'dist',
    async (candidate) => {
      await build({ config: join(root, 'tsdown.config.ts'), outDir: candidate, clean: true })
    },
    signal,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCli((signal) => buildPackage(signal))
}
