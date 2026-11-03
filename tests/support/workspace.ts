/** @fileoverview Discovers maintained files and workspace members for repository checks. */

import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { readPnpm } from '@kisaki3/tooling/process'

/** Enumerate files below the repository root, excluding evidence and generated output. */
export async function maintainedFiles(root: string): Promise<string[]> {
  const ignored = new Set([
    '.git',
    'node_modules',
    'out',
    'dist',
    '.cache',
    '.local',
    '.vitest',
    '.turbo',
    'target',
    'test-results',
    'playwright-report',
    'coverage',
  ])

  /** Read this directory and its maintained descendants, propagating enumeration failures. */
  async function visit(directory: string): Promise<string[]> {
    const result: string[] = []

    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (ignored.has(entry.name)) {
        continue
      }
      if (directory === root && ['refactor', 'artifacts'].includes(entry.name)) {
        continue
      }

      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        result.push(...(await visit(path)))
      } else {
        result.push(path)
      }
    }

    return result
  }

  return visit(root)
}

/** Read pnpm-registered member manifests and their repository-relative directories. */
export async function workspaceMembers(
  root: string,
): Promise<{ directory: string; manifest: Record<string, unknown> }[]> {
  const selected = JSON.parse(
    await readPnpm(['list', '--recursive', '--depth', '-1', '--json'], root),
  ) as { path: string }[]

  const directories = selected
    .map((member) => relative(root, member.path).replaceAll('\\', '/'))
    .filter(Boolean)

  return Promise.all(
    directories.map(async (directory) => ({
      directory,
      manifest: JSON.parse(await readFile(join(root, directory, 'package.json'), 'utf8')) as Record<
        string,
        unknown
      >,
    })),
  )
}
