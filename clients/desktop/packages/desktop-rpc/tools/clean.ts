/** @fileoverview Removes this package's generated distribution and tarball outputs. */

import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { runCli } from '@kisaki3/tooling/cli'

/** Remove the distribution and archive after consumers stop. */
export async function cleanOutput(signal?: AbortSignal): Promise<void> {
  for (const output of ['dist', 'out']) {
    signal?.throwIfAborted()
    await rm(resolve(import.meta.dirname, '..', output), { recursive: true, force: true })
  }
}

if (import.meta.main) {
  await runCli(cleanOutput)
}
