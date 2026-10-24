import { readdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { appRoot } from './lib/paths'
import { requireChildPath } from './lib/output'

/** Remove only this application's declared build outputs; preserve caches and profiles. */
export async function cleanOutputs(): Promise<void> {
  /** Reject cleanup while a build, package operation or development session owns an output. */
  async function requireIdle(directory: string): Promise<void> {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return
      throw cause
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.endsWith('.lock') || entry.name === '.session-lock') {
        throw new Error('Stop the active desktop workflow before cleaning its output')
      }
      await requireIdle(join(directory, entry.name))
    }
  }
  for (const name of ['out', 'dist']) await requireIdle(join(appRoot, name))
  for (const name of ['out', 'dist']) {
    const target = requireChildPath(appRoot, join(appRoot, name))
    await rm(target, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await cleanOutputs()
  } catch (cause) {
    console.error(cause)
    process.exitCode = 1
  }
}
