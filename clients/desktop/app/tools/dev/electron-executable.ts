import { createRequire } from 'node:module'

export function electronExecutable(): string {
  const executable: unknown = createRequire(import.meta.url)('electron')
  if (typeof executable !== 'string') {
    throw new Error('The Electron executable is unavailable in this host')
  }

  return executable
}
