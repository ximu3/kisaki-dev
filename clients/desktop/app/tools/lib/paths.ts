/**
 * @fileoverview Locates the desktop workspace and its finite build outputs for each
 * target.
 */

import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DesktopTarget } from '../../src/shared/runtime-manifest'

export const appRoot = fileURLToPath(new URL('../..', import.meta.url))
export const repositoryRoot = resolve(appRoot, '../../..')

/** Locate a finite build. Development generations use their own directory. */
export function buildDirectory(target: DesktopTarget): string {
  return join(appRoot, 'out', target)
}
