import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { appRoot } from './lib/paths'
import { runCli, withOutputs } from '../../../../tools/outputs'

/** Remove declared application outputs under exclusive project access; preserve caches and profiles. */
export async function cleanOutputs(signal?: AbortSignal): Promise<void> {
  await withOutputs(
    [{ project: appRoot, mode: 'clean' }],
    async (active) => {
      for (const name of ['out', 'dist']) {
        active.throwIfAborted()
        await rm(join(appRoot, name), { recursive: true, force: true })
      }
    },
    signal ? { signal } : {},
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCli((signal) => cleanOutputs(signal))
}
