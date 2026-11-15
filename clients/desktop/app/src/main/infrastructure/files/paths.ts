/** @fileoverview Compares actual filesystem locations while preserving spelling and unresolved path information. */

import { realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, parse, sep } from 'node:path'
import type { BigIntStats } from 'node:fs'
import type { NativeFiles } from '#native'

/** A confirmed relationship between two locations, or an explicit inability to establish it. */
export type PathRelation = 'same' | 'contains' | 'within' | 'separate' | 'unknown'

/** Normalizes separators, current-directory segments and drive spelling without folding linked '..' segments. */
export function normalizeAbsolutePath(input: string): string {
  if (!isAbsolute(input) || input.includes('\0')) {
    throw new TypeError('Expected an absolute filesystem path without NUL')
  }
  const path =
    process.platform === 'win32'
      ? input.replaceAll('/', '\\').replace(/^[a-z]:/u, (drive) => drive.toUpperCase())
      : input
  const root = parse(path).root
  const pieces = path
    .slice(root.length)
    .split(sep)
    .filter((piece) => piece !== '' && piece !== '.')
  return root + pieces.join(sep)
}

/** Compares actual device and file identities after resolving links through the filesystem. */
function sameIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino
}

/** Checks the ancestors of an existing canonical path without relying on textual prefixes. */
async function isAncestor(owner: BigIntStats, child: string): Promise<boolean> {
  let path = dirname(child)
  while (true) {
    if (sameIdentity(owner, await stat(path, { bigint: true }))) {
      return true
    }
    const parent = dirname(path)
    if (parent === path) {
      return false
    }
    path = parent
  }
}

/**
 * Establishes equality and containment using actual names and file identities.
 *
 * Identical normalized positions compare equal even while offline. Unavailable differing paths
 * remain unknown; case sensitivity is never inferred from the operating-system name.
 */
export async function comparePaths(first: string, second: string): Promise<PathRelation> {
  const left = normalizeAbsolutePath(first)
  const right = normalizeAbsolutePath(second)
  if (left === right) {
    return 'same'
  }

  try {
    const [leftPath, rightPath] = await Promise.all([realpath(left), realpath(right)])
    const [leftInfo, rightInfo] = await Promise.all([
      stat(leftPath, { bigint: true }),
      stat(rightPath, { bigint: true }),
    ])
    if (sameIdentity(leftInfo, rightInfo)) {
      return 'same'
    }
    if (leftInfo.isDirectory() && (await isAncestor(leftInfo, rightPath))) {
      return 'contains'
    }
    if (rightInfo.isDirectory() && (await isAncestor(rightInfo, leftPath))) {
      return 'within'
    }
    return 'separate'
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      ['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM', 'ENODEV', 'ESTALE'].includes(String(error.code))
    ) {
      return 'unknown'
    }
    throw error
  }
}

/**
 * Verifies an existing data directory's backing volume before SQLite is opened.
 *
 * Network and unverified filesystems fail explicitly; media access is unaffected.
 */
export async function assertLocalDataDirectory(path: string, native: NativeFiles): Promise<void> {
  const location = await native.getFilesystemLocation(normalizeAbsolutePath(path))
  if (location !== 'local') {
    throw new Error(
      location === 'network'
        ? 'The database data directory must be on a local filesystem'
        : 'The data directory filesystem could not be verified',
    )
  }
}
