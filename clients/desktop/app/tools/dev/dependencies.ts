/** @fileoverview Discovers production workspace dependencies through pnpm. */

import { realpath } from 'node:fs/promises'
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
