import { rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

/** Remove only this package's declared outputs, preserving its cache and active writer. */
export async function cleanOutputs(): Promise<void> {
  try {
    await stat(join(root, '.cache', 'build.lock'))
    throw new Error('Stop the package build before cleaning its output')
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
  }
  for (const name of ['dist', 'out']) await rm(join(root, name), { recursive: true, force: true })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await cleanOutputs()
  } catch (cause) {
    console.error(cause)
    process.exitCode = 1
  }
}
