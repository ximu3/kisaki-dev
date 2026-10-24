import { createRequire } from 'node:module'

/** Return the executable path exported by the installed Electron package in Node. */
export function electronExecutable(): string {
  const executable: unknown = createRequire(import.meta.url)('electron')
  if (typeof executable !== 'string') {
    throw new Error('The Electron executable is unavailable in this host')
  }
  return executable
}
