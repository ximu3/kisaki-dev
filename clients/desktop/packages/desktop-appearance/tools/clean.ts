/** @fileoverview Removes the visual package's declared output after its consumers stop. */

import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runCli } from '@kisaki3/tooling/cli'

/** Remove this project's compiled files and tarball; retain source and build caches. */
export async function cleanOutput(signal?: AbortSignal): Promise<void> {
  for (const output of ['dist', 'out']) {
    signal?.throwIfAborted()
    await rm(resolve(import.meta.dirname, '..', output), { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCli(cleanOutput)
}
