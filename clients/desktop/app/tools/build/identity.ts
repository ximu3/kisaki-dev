import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { appRoot, repositoryRoot } from '../lib/paths'
import { sha256 } from '../lib/sha256'

/** Hash only declared engineering inputs, excluding state, caches and earlier outputs. */
export async function sourceIdentity(): Promise<string> {
  const digest = createHash('sha256')

  /** Traverse owned inputs in stable order, preserving names in the identity. */
  async function include(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
      if (['node_modules', '.cache', 'target', 'out', 'tests'].includes(entry.name)) continue
      if (/\.test\.tsx?$/.test(entry.name)) continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        await include(path)
      } else {
        digest.update(relative(repositoryRoot, path).replaceAll('\\', '/'))
        digest.update('\0')
        digest.update(await readFile(path))
      }
    }
  }

  for (const name of ['src', 'native', 'tools', 'assets', 'config']) {
    await include(join(appRoot, name))
  }
  for (const entry of await readdir(appRoot)) {
    if (entry.endsWith('.ts') || entry.endsWith('.json') || entry.endsWith('.yml')) {
      digest.update(entry).update(await readFile(join(appRoot, entry)))
    }
  }
  for (const file of ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json']) {
    digest.update(file).update(await readFile(join(repositoryRoot, file)))
  }

  const packages = join(appRoot, '..', 'packages')
  for (const name of (await readdir(packages)).sort()) {
    const packageRoot = join(packages, name)
    await include(join(packageRoot, 'src'))
    await include(join(packageRoot, 'tools'))
    for (const entry of (await readdir(packageRoot)).sort()) {
      if (entry.endsWith('.ts') || entry.endsWith('.json')) {
        digest.update(`${name}/${entry}`).update(await readFile(join(packageRoot, entry)))
      }
    }
  }

  return digest.digest('hex')
}

/** Record every runtime byte after all owners have completed their outputs. */
export async function runtimeFiles(directory: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {}

  /** Add each runtime file's digest, using paths relative to the build directory. */
  async function visit(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        await visit(path)
      } else {
        const name = relative(directory, path).replaceAll('\\', '/')
        if (name !== 'build.json') files[name] = sha256(await readFile(path))
      }
    }
  }

  await visit(directory)
  return files
}
