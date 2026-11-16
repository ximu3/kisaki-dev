/** @fileoverview Compares actual filesystem locations while preserving spelling and unresolved path information. */

import { realpath, stat } from 'node:fs/promises'
import { dirname, join, normalize, parse, sep } from 'node:path'
import { isAbsoluteHostPath } from '#host-path'
import { FilesystemQueryError, type NativeFiles } from '#native'

/** A confirmed relationship between two locations, or an explicit inability to establish it. */
export type PathRelation = 'same' | 'contains' | 'within' | 'separate' | 'unknown'

/** Extracts the host root, including the server and share of an extended Windows UNC path. */
function pathRoot(path: string): string {
  const root = parse(path).root
  if (process.platform === 'win32' && root.toUpperCase() === '\\\\?\\UNC\\') {
    const share = parse('\\\\' + path.slice(root.length)).root
    return root + share.slice(2)
  }
  return root
}

/** Normalizes separators, current-directory segments and drive spelling without folding linked '..' segments. */
export function normalizeAbsolutePath(input: string): string {
  if (!isAbsoluteHostPath(input)) {
    throw new TypeError('Expected an absolute filesystem path without NUL')
  }
  const path =
    process.platform === 'win32'
      ? input.replaceAll('/', '\\').replace(/^[a-z]:/u, (drive) => drive.toUpperCase())
      : input
  const root = pathRoot(path)
  const pieces = path
    .slice(root.length)
    .split(sep)
    .filter((piece) => piece !== '' && piece !== '.')
  const normalizedRoot = normalize(root)
  return (normalizedRoot.endsWith(sep) ? normalizedRoot : normalizedRoot + sep) + pieces.join(sep)
}

/** Observes a traversable position, keeping the chosen route through every surviving link. */
async function inspectPosition(path: string) {
  await stat(path)
  let root = pathRoot(path)
  let names = path.slice(root.length).split(sep).filter(Boolean)
  if (names.includes('..')) {
    let current = root
    for (const name of names) {
      if (name !== '..') {
        current = join(current, name)
        continue
      }

      // Ask the host where '..' leads before removing any part of the registered route.
      const parent = dirname(current)
      const [reached, expected] = await Promise.all([
        realpath(current + sep + '..'),
        realpath(parent),
      ])
      current = reached === expected ? parent : reached
    }
    root = pathRoot(current)
    names = current.slice(root.length).split(sep).filter(Boolean)
  }
  return { root, names }
}

/** Verifies differently cased Windows root spellings against the actual mounted directories. */
async function sameRoot(first: string, second: string): Promise<boolean> {
  if (first === second) {
    return true
  }
  if (process.platform !== 'win32' || first.toUpperCase() !== second.toUpperCase()) {
    return false
  }
  const [left, right] = await Promise.all([
    stat(first, { bigint: true }),
    stat(second, { bigint: true }),
  ])
  return left.dev === right.dev && left.ino === right.ino
}

/**
 * Compares registered positions by the directory entries selected at each step.
 *
 * Identical normalized positions compare equal while offline. A failed filesystem observation
 * leaves the relationship unknown. Containment follows the chosen entry through a linked directory.
 */
export async function comparePaths(
  first: string,
  second: string,
  native: NativeFiles,
): Promise<PathRelation> {
  const firstPath = normalizeAbsolutePath(first)
  const secondPath = normalizeAbsolutePath(second)
  if (firstPath === secondPath) {
    return 'same'
  }

  try {
    const [left, right] = await Promise.all([
      inspectPosition(firstPath),
      inspectPosition(secondPath),
    ])
    if (!(await sameRoot(left.root, right.root))) {
      return 'separate'
    }

    let parent = left.root
    const sharedLength = Math.min(left.names.length, right.names.length)
    for (let index = 0; index < sharedLength; index++) {
      const firstName = left.names[index]!
      const secondName = right.names[index]!
      if (
        firstName !== secondName &&
        !(await native.sameDirectoryEntry(parent, firstName, secondName))
      ) {
        return 'separate'
      }
      parent = join(parent, firstName)
    }

    if (left.names.length === right.names.length) {
      return 'same'
    }
    return left.names.length < right.names.length ? 'contains' : 'within'
  } catch (error) {
    if (
      (error instanceof FilesystemQueryError && error.reason !== 'invalidArgument') ||
      (error instanceof Error && 'syscall' in error && 'code' in error)
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
