import { lstat } from 'node:fs/promises'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

export async function entryInfo(path: string) {
  try {
    return await lstat(path)
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw cause
  }
}

export async function checkDirectory(path: string) {
  const info = await entryInfo(path)
  if (info && !info.isDirectory()) {
    throw new DesktopError('PathConflict', 'An attachment directory has been replaced')
  }
  return info !== null
}
