/** @fileoverview Discovers workspace dependencies and prepares one complete candidate copy. */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { readPnpm } from '@kisaki3/tooling/process'
import { repositoryRoot } from '../lib/paths'

/** A production workspace dependency consumed through its built exports. */
export interface DesktopDependency {
  name: string
  path: string
}

/** Read the dependency identities already resolved by the workspace package manager. */
export async function desktopDependencies(signal?: AbortSignal): Promise<DesktopDependency[]> {
  const members = JSON.parse(
    await readPnpm(
      ['list', '--filter-prod', '@kisaki3/desktop^...', '--depth', '-1', '--json'],
      repositoryRoot,
      { signal },
    ),
  ) as DesktopDependency[]
  return Promise.all(
    members.map(async (member) => ({ name: member.name, path: await realpath(member.path) })),
  )
}

/** One complete dependency copy, owned by its caller until handed to the renderer. */
export interface DependencySnapshot {
  id: string
  directory: string
  packages: ReadonlyMap<string, string>
}

/**
 * Prepare package manifests and built files without selecting Node or browser export conditions.
 * Failure removes the candidate; success transfers its directory to the caller for adoption or cleanup.
 */
export async function captureDependencies(
  members: DesktopDependency[],
  directory: string,
): Promise<DependencySnapshot> {
  await mkdir(directory, { recursive: true })
  const candidate = await mkdtemp(join(directory, 'candidate-'))
  const digest = createHash('sha256')
  const packages = new Map<string, string>()

  /** Copy one immutable input and include its path and byte length in the candidate identity. */
  async function copy(source: string, name: string): Promise<void> {
    const bytes = await readFile(source)
    const target = join(candidate, 'node_modules', name)
    digest.update(name).update('\0').update(String(bytes.length)).update('\0').update(bytes)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, bytes)
  }

  /** Built output consists of regular files; a link would not provide a stable copied value. */
  async function collect(source: string, prefix: string): Promise<void> {
    for (const entry of (await readdir(source, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name, 'en'),
    )) {
      if (entry.isDirectory()) {
        await collect(join(source, entry.name), `${prefix}/${entry.name}`)
      } else if (entry.isFile()) {
        await copy(join(source, entry.name), `${prefix}/${entry.name}`)
      } else {
        throw new Error('Public build output must not contain filesystem links')
      }
    }
  }

  try {
    for (const member of [...members].sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      await copy(join(member.path, 'package.json'), `${member.name}/package.json`)
      await collect(join(member.path, 'dist'), `${member.name}/dist`)
      packages.set(member.name, join(candidate, 'node_modules', member.name))
    }
    return { id: digest.digest('hex'), directory: candidate, packages }
  } catch (cause) {
    try {
      await rm(candidate, { recursive: true, force: true })
    } catch (cleanup) {
      throw new AggregateError([cause, cleanup], 'Dependency preparation and cleanup failed', {
        cause: cleanup,
      })
    }
    throw cause
  }
}
