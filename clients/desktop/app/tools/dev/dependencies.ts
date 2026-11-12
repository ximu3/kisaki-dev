/** @fileoverview Discovers workspace dependencies and prepares one complete candidate copy. */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { readPnpm } from '@kisaki3/tooling/process'
import { repositoryRoot } from '../lib/paths'

/** A production workspace dependency consumed through its built exports. */
export interface DesktopDependency {
  name: string
  /** Real path of the workspace package root. */
  path: string
}

/**
 * Reads production workspace dependencies from pnpm and resolves their real package directories.
 */
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

/**
 * Content-identified copy of built workspace dependencies.
 *
 * The caller owns its directory until adoption transfers that ownership to the renderer.
 */
export interface DependencySnapshot {
  /** SHA-256 over copied names, byte lengths and contents. */
  id: string
  directory: string
  /** Package name to its directory inside this candidate. */
  packages: ReadonlyMap<string, string>
}

/**
 * Copies package manifests and built files into an owned dependency candidate.
 *
 * Retains package export conditions for the consuming resolver. Returns the completed copy and its
 * digest; preparation failure removes the candidate and reports any cleanup failure.
 */
export async function captureDependencies(
  members: DesktopDependency[],
  directory: string,
): Promise<DependencySnapshot> {
  await mkdir(directory, { recursive: true })
  const candidate = await mkdtemp(join(directory, 'candidate-'))
  const digest = createHash('sha256')
  const packages = new Map<string, string>()

  /**
   * Copies one input file and adds its destination name, byte length and contents to the candidate
   * digest.
   */
  async function copy(source: string, name: string): Promise<void> {
    const bytes = await readFile(source)
    const target = join(candidate, 'node_modules', name)
    digest.update(name).update('\0').update(String(bytes.length)).update('\0').update(bytes)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, bytes)
  }

  /** Copies regular files in deterministic directory order and rejects filesystem links. */
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
