import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DesktopTarget } from './targets'

export const appRoot = fileURLToPath(new URL('../..', import.meta.url))

export const repositoryRoot = resolve(appRoot, '../../..')

export function containsPath(parent: string, path: string): boolean {
  const child = relative(parent, path)
  return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

export function buildDirectory(target: DesktopTarget): string {
  return join(appRoot, 'out', target)
}
