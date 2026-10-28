/**
 * @fileoverview Removes the appearance package's build and tarball outputs while retaining
 * its project cache.
 */

import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runCli } from '@kisaki3/tooling/cli'

const root = fileURLToPath(new URL('..', import.meta.url))

/** Remove this package's declared outputs after its tasks stop; preserve the project cache. */
export async function cleanOutputs(signal?: AbortSignal): Promise<void> {
  for (const name of ['dist', 'out']) {
    signal?.throwIfAborted()
    await rm(join(root, name), { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCli((signal) => cleanOutputs(signal))
}
