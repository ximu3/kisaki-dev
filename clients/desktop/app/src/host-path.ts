/** @fileoverview Identifies fully qualified filesystem paths for the desktop's Node host. */

import { isAbsolute, parse } from 'node:path'

/** Checks that a path identifies its root independently of the working directory and current drive. */
export function isAbsoluteHostPath(path: string): boolean {
  if (!isAbsolute(path) || path.includes('\0')) {
    return false
  }
  // On Windows, a single separator is rooted on whichever drive the process is using.
  return process.platform !== 'win32' || parse(path).root.length > 1
}
