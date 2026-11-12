/**
 * @fileoverview Removes desktop build and distribution outputs while retaining profiles
 * and caches.
 */

import { removeOutputs } from '@kisaki3/tooling/output'
import { appRoot } from './lib/paths'
import { runCli } from '@kisaki3/tooling/cli'

/**
 * Removes declared desktop outputs after their active tasks stop; caches and profiles remain owned
 * separately.
 */
export function cleanOutputs(signal?: AbortSignal): Promise<void> {
  return removeOutputs(appRoot, ['out', 'dist'], signal)
}

if (import.meta.main) {
  await runCli(cleanOutputs)
}
