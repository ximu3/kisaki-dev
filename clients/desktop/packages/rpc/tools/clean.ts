import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runCli, withOutputs } from '../../../../../tools/outputs'

const root = fileURLToPath(new URL('..', import.meta.url))

/** Remove declared outputs under exclusive project ownership; preserve the project cache. */
export async function cleanOutputs(signal?: AbortSignal): Promise<void> {
  await withOutputs(
    [{ project: root, mode: 'clean' }],
    async (active) => {
      for (const name of ['dist', 'out']) {
        active.throwIfAborted()
        await rm(join(root, name), { recursive: true, force: true })
      }
    },
    signal ? { signal } : {},
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCli((signal) => cleanOutputs(signal))
}
