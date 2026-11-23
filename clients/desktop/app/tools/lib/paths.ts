import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DesktopTarget } from './targets'

/**
 * The desktop engineering package root, resolved from this module rather than the working
 * directory.
 */
export const appRoot = fileURLToPath(new URL('../..', import.meta.url))

export const repositoryRoot = resolve(appRoot, '../../..')

/**
 * Checks whether a path is the root itself or a descendant using complete platform path segments.
 */
export function containsPath(parent: string, path: string): boolean {
  const child = relative(parent, path)
  return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

/** Returns the target's build directory. Development sessions use their own output directories. */
export function buildDirectory(target: DesktopTarget): string {
  return join(appRoot, 'out', target)
}
