import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { ViteDevServer } from 'vite'
import { readPnpm } from '@kisaki3/tooling/process'
import { repositoryRoot } from '../lib/paths'

/** A public workspace dependency whose built exports feed the development session. */
export interface DesktopDependency {
  name: string
  path: string
}

/** Read production workspace dependencies from pnpm before taking a development snapshot. */
export async function desktopDependencies(signal?: AbortSignal): Promise<DesktopDependency[]> {
  const value: unknown = JSON.parse(
    await readPnpm(
      ['list', '--filter-prod', '@kisaki3/desktop^...', '--depth', '-1', '--json'],
      repositoryRoot,
      { signal },
    ),
  )
  if (!Array.isArray(value)) throw new Error('Desktop dependencies are unavailable')
  return Promise.all(
    value.map(async (member: unknown) => {
      if (
        !member ||
        typeof member !== 'object' ||
        !('name' in member) ||
        typeof member.name !== 'string' ||
        !('path' in member) ||
        typeof member.path !== 'string' ||
        !isAbsolute(member.path)
      ) {
        throw new Error('Invalid desktop workspace dependency')
      }
      return { name: member.name, path: await realpath(member.path) }
    }),
  )
}

/** A public-package snapshot retained for the development session's lifetime. */
export interface DependencySnapshot {
  id: string
  sizeBytes: number
  packages: ReadonlyMap<string, string>
}

/** Vite's client resolver, accessed through the environment that currently owns the server. */
export type DependencyResolver =
  ViteDevServer['environments']['client']['pluginContainer']['resolveId']

/** Capture complete packages and validate their runtime exports with Vite before adoption. */
export async function captureDependencies(
  members: DesktopDependency[],
  directory: string,
  existing: Map<string, DependencySnapshot>,
  resolveDependency: DependencyResolver,
): Promise<DependencySnapshot> {
  const content = new Map<string, Uint8Array>()
  const manifests = new Map<string, unknown>()
  let sizeBytes = 0
  const digest = createHash('sha256')

  /** Collect regular build files; linked entries are unsupported snapshot inputs. */
  async function collect(source: string, prefix: string): Promise<void> {
    for (const entry of (await readdir(source, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name, 'en'),
    )) {
      const name = `${prefix}/${entry.name}`
      if (entry.isDirectory()) {
        await collect(join(source, entry.name), name)
      } else if (entry.isFile()) {
        const value = await readFile(join(source, entry.name))
        content.set(name, value)
        sizeBytes += value.byteLength
      } else {
        throw new Error('Public build output must not contain filesystem links')
      }
    }
  }

  for (const member of [...members].sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (!/^@kisaki3\/[a-z0-9-]+$/.test(member.name)) {
      throw new Error('Unexpected desktop workspace dependency')
    }
    const manifest = await readFile(join(member.path, 'package.json'))
    manifests.set(member.name, JSON.parse(manifest.toString()))
    content.set(`${member.name}/package.json`, manifest)
    sizeBytes += manifest.byteLength
    await collect(join(member.path, 'dist'), `${member.name}/dist`)
  }

  for (const [name, value] of content) digest.update(name).update('\0').update(value)
  const id = digest.digest('hex')
  const previous = existing.get(id)

  // Snapshots remain readable until session end; cap accumulated build outputs at 256 MiB.
  const budgetBytes = 256 * 1024 * 1024
  if (
    !previous &&
    sizeBytes + [...existing.values()].reduce((sum, item) => sum + item.sizeBytes, 0) > budgetBytes
  ) {
    throw new Error('Development dependency snapshots exceed 256 MiB; restart the session')
  }

  const root = join(directory, id, 'node_modules')
  const packages = new Map<string, string>()
  const entries = new Map<string, string[]>()
  for (const [name, manifest] of manifests) {
    if (
      !manifest ||
      typeof manifest !== 'object' ||
      !('name' in manifest) ||
      manifest.name !== name ||
      !('exports' in manifest) ||
      !manifest.exports ||
      typeof manifest.exports !== 'object' ||
      Array.isArray(manifest.exports)
    ) {
      throw new Error('Public package exports are unavailable')
    }

    const exports = Object.keys(manifest.exports)
    for (const entry of exports) {
      if ((entry !== '.' && !entry.startsWith('./')) || entry.includes('*')) {
        throw new Error('Desktop package exports must be explicit')
      }
    }
    packages.set(name, join(root, name))
    entries.set(name, exports)
  }

  try {
    if (!previous) {
      for (const [name, value] of content) {
        await mkdir(dirname(join(root, name)), { recursive: true })
        await writeFile(join(root, name), value)
      }
    }

    for (const [name, exports] of entries) {
      const packageRoot = packages.get(name)!
      for (const entry of exports) {
        const specifier = entry === '.' ? name : `${name}${entry.slice(1)}`
        const selected = await resolveDependency(specifier, join(packageRoot, 'package.json'))
        if (!selected || selected.external || !isAbsolute(selected.id)) {
          throw new Error(`Public export could not be resolved: ${specifier}`)
        }

        const path = resolve(selected.id.replace(/[?#].*$/, ''))
        const output = relative(join(packageRoot, 'dist'), path)
        if (!output || output === '..' || output.startsWith(`..${sep}`) || isAbsolute(output)) {
          throw new Error('Public runtime exports must use built output')
        }
        if (!content.has(relative(root, path).split(sep).join('/'))) {
          throw new Error(`Public export has no build output: ${specifier}`)
        }
      }
    }
  } catch (cause) {
    if (!previous) await rm(join(directory, id), { recursive: true, force: true })
    throw cause
  }

  const snapshot = previous ?? { id, sizeBytes, packages }
  existing.set(id, snapshot)
  return snapshot
}
