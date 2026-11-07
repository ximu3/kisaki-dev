/**
 * @fileoverview Locates the desktop workspace and its finite build outputs for each
 * target.
 */

import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DesktopTarget } from './runtime-manifest'

export const appRoot = fileURLToPath(new URL('../..', import.meta.url))
export const repositoryRoot = resolve(appRoot, '../../..')

/** Include the root itself and its descendants, comparing complete platform path segments. */
export function containsPath(parent: string, path: string): boolean {
  const child = relative(parent, path)
  return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

/** Locate a finite build. Development generations use their own directory. */
export function buildDirectory(target: DesktopTarget): string {
  return join(appRoot, 'out', target)
}
