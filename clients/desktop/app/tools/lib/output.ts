import { mkdir, mkdtemp, rename, rm, stat } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

/** Return an absolute descendant of root; reject root itself and paths outside it. */
export function requireChildPath(root: string, path: string): string {
  const absoluteRoot = resolve(root)
  const absolutePath = resolve(path)
  if (!absolutePath.startsWith(`${absoluteRoot}${sep}`)) {
    throw new Error('Output path is outside the owned directory')
  }

  return absolutePath
}

/** Build into a private directory and replace only after success; concurrent writers fail. */
export async function replaceOutput<T>(
  output: string,
  prepare: (staging: string) => Promise<T>,
): Promise<T> {
  await mkdir(dirname(output), { recursive: true })
  const lock = `${output}.lock`
  await mkdir(lock)
  let staging: string | undefined
  let movedPrevious = false

  try {
    staging = await mkdtemp(`${output}.staging-`)
    const previous = `${staging}.previous`
    const value = await prepare(staging)

    try {
      await stat(output)
      await rename(output, previous)
      movedPrevious = true
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
    }

    try {
      await rename(staging, output)
    } catch (cause) {
      if (movedPrevious) await rename(previous, output)
      throw cause
    }

    await rm(previous, { recursive: true, force: true })
    return value
  } finally {
    if (staging) await rm(staging, { recursive: true, force: true })
    await rm(lock, { recursive: true, force: true })
  }
}
