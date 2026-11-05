/**
 * @fileoverview Removes desktop build and distribution outputs while retaining profiles
 * and caches.
 */

import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { appRoot } from './lib/paths'
import { runCli } from '@kisaki3/tooling/cli'

/** Remove declared application outputs after its tasks stop; preserve caches and profiles. */
export async function cleanOutputs(signal?: AbortSignal): Promise<void> {
  for (const name of ['out', 'dist']) {
    signal?.throwIfAborted()

    await rm(join(appRoot, name), { recursive: true, force: true })
  }
}

if (import.meta.main) {
  await runCli(cleanOutputs)
}
