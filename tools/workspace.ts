/** @fileoverview Reads workspace project identities and dependency selections from the locked pnpm. */

import { execFileSync } from 'node:child_process'
import { relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Root checkout shared by repository tools that inspect workspace members. */
export const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))

/** Project identity and its repository-relative source directory. */
export interface Project {
  name: string
  directory: string
}

/** Reads native pnpm workspace selectors, including their transitive dependency edges. */
export function listProjects(...filters: string[]): Project[] {
  const pnpm = process.env.npm_execpath
  if (!pnpm) {
    throw new Error('Run workspace tools through pnpm')
  }
  const selection = filters.length
    ? [...filters.flatMap((filter) => ['--filter', filter]), '--fail-if-no-match']
    : ['--recursive']
  const output = execFileSync(pnpm, [...selection, 'list', '--depth', '-1', '--json'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
  const projects = JSON.parse(output) as { name: string; path: string }[]
  return projects.map(({ name, path }) => ({
    name,
    directory: relative(repositoryRoot, path).split(sep).join('/'),
  }))
}
