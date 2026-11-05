/** @fileoverview Removes this package's generated distribution and tarball outputs. */

import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { runCli } from '@kisaki3/tooling/cli'

/** Remove declared outputs after consumers stop; sources and dependency caches remain owned separately. */
export async function cleanOutput(signal?: AbortSignal): Promise<void> {
  for (const output of ['dist', 'out']) {
    signal?.throwIfAborted()
    await rm(resolve(import.meta.dirname, '..', output), { recursive: true, force: true })
  }
}

if (import.meta.main) {
  await runCli(cleanOutput)
}
