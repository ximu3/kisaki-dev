import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { opendir } from 'node:fs/promises'
import { normalizeAbsolutePath } from '../../../../infrastructure/files'

export async function inspectDirectory(raw: string) {
  const path = normalizeAbsolutePath(raw)
  try {
    const input = await opendir(path)
    await input.close()
    return path
  } catch (cause) {
    if (cause instanceof Error && 'code' in cause && cause.code === 'ENOTDIR') {
      throw new DesktopError('InvalidInput', 'Choose a directory', { cause })
    }
    throw new DesktopError('FileUnavailable', 'The selected directory could not be opened', {
      cause,
    })
  }
}
