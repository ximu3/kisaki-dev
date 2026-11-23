import { realpath, stat } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { nativeHostPath, parseHostPath, type HostPath } from '#host-path'
import { FilesystemQueryError, type NativeFiles } from '#native'

/** A confirmed relationship between two locations, or an explicit inability to establish it. */
export type PathRelation = 'same' | 'contains' | 'within' | 'separate' | 'unknown'

/** Normalizes separators, current-directory segments and drive spelling without folding linked '..' segments. */
export function normalizeAbsolutePath(input: string): string {
  return parseHostPath(input).path
}

/** Uses Node's lookup namespace for literal names and leaves parent traversal to the host. */
function lexicalPosition(position: HostPath): string {
  if (position.names.length === 0) {
    return position.volume
  }
  if (position.names.includes('..')) {
    return position.path
  }
  return position.lookupRoot + position.names.join(sep)
}

/** Locates the host's observed parent through the nearest surviving registered ancestor. */
async function registeredParent(current: HostPath): Promise<string> {
  const reached = await realpath(current.path + sep + '..')
  const names = current.names.slice(0, -1)
  while (names.length > 0) {
    const route = current.root + names.join(sep)
    const physical = await realpath(route)
    if (reached === physical) {
      return route
    }

    const prefix = physical.endsWith(sep) ? physical : physical + sep
    if (reached.startsWith(prefix)) {
      return join(route, reached.slice(prefix.length))
    }
    names.pop()
  }
  return reached
}

/** Observes the lookup route, retaining explicit links outside any consumed parent traversal. */
async function inspectPosition(input: HostPath) {
  // Node selects the Windows lookup spelling before handing parent traversal to the filesystem.
  const position =
    process.platform === 'win32' && input.names.includes('..')
      ? parseHostPath(nativeHostPath(input.path)!)
      : input
  // A reachable descendant observes its root. Differently named roots are compared by native handles.
  if (position.names.length === 0) {
    return position
  }
  await stat(position.path)
  if (!position.names.includes('..')) {
    return position
  }

  let current = position.root
  for (const name of position.names) {
    if (name !== '..') {
      current = join(current, name)
    } else {
      const route = parseHostPath(current)
      if (route.names.length > 0) {
        current = await registeredParent(route)
      }
    }
  }
  return parseHostPath(current)
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
  const firstPath = parseHostPath(first)
  const secondPath = parseHostPath(second)
  if (lexicalPosition(firstPath) === lexicalPosition(secondPath)) {
    return 'same'
  }

  try {
    const [left, right] = await Promise.all([
      inspectPosition(firstPath),
      inspectPosition(secondPath),
    ])
    if (
      left.volume !== right.volume &&
      !(await native.sameDirectoryEntry(left.lookupRoot, right.lookupRoot))
    ) {
      return 'separate'
    }

    let leftEntry = left.lookupRoot
    let rightEntry = right.lookupRoot
    const sharedLength = Math.min(left.names.length, right.names.length)
    for (let index = 0; index < sharedLength; index++) {
      leftEntry = join(leftEntry, left.names[index]!)
      rightEntry = join(rightEntry, right.names[index]!)
      if (leftEntry !== rightEntry && !(await native.sameDirectoryEntry(leftEntry, rightEntry))) {
        return 'separate'
      }
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
