/**
 * @fileoverview Resolves a prepared portable data directory from the marker beside a
 * movable application carrier.
 */

import { lstatSync } from 'node:fs'
import { join } from 'node:path'

/** Return the prepared data directory; an absent marker selects ordinary mode. */
export function portableDataDirectory(
  programDirectory: string,
  dataDirectoryName: string,
): string | undefined {
  const marker = join(programDirectory, 'kisaki-portable.txt')
  try {
    const info = lstatSync(marker)
    if (!info.isFile()) throw new Error('The portable mode marker must be a regular file')
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw cause
  }

  const directory = join(programDirectory, dataDirectoryName)
  if (!lstatSync(directory).isDirectory()) {
    throw new Error('The prepared portable data directory is unavailable')
  }

  return directory
}
