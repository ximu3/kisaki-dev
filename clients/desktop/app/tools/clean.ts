/**
 * @fileoverview Removes desktop build and distribution outputs while retaining profiles
 * and caches.
 */

import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { appRoot } from './lib/paths'
import { runCli } from '@kisaki3/tooling/cli'

/** Remove declared application outputs after its tasks stop; preserve caches and profiles. */
export async function cleanOutputs(signal?: AbortSignal): Promise<void> {
  for (const name of ['out', 'dist']) {
    signal?.throwIfAborted()

    await rm(join(appRoot, name), { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCli((signal) => cleanOutputs(signal))
}
