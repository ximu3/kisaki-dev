/**
 * @fileoverview Locates the desktop workspace and its finite build outputs for each
 * target.
 */

import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DesktopTarget } from './targets'

/**
 * The desktop engineering package root, resolved from this module rather than the working
 * directory.
 */
export const appRoot = fileURLToPath(new URL('../..', import.meta.url))

/** The containing Kisaki checkout used by workspace-level engineering tasks. */
export const repositoryRoot = resolve(appRoot, '../../..')

/**
 * Checks whether a path is the root itself or a descendant using complete platform path segments.
 */
export function containsPath(parent: string, path: string): boolean {
  const child = relative(parent, path)
  return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

/** Returns the target's finite-build directory; development generations have a separate owner. */
export function buildDirectory(target: DesktopTarget): string {
  return join(appRoot, 'out', target)
}
