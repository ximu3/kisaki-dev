/**
 * @fileoverview Removes desktop build and distribution outputs while retaining profiles
 * and caches.
 */

import { removeOutputs } from '@kisaki3/tooling/output'
import { appRoot } from './lib/paths'
import { runCli } from '@kisaki3/tooling/cli'

/** Remove declared application outputs after its tasks stop; preserve caches and profiles. */
export function cleanOutputs(signal?: AbortSignal): Promise<void> {
  return removeOutputs(appRoot, ['out', 'dist'], signal)
}

if (import.meta.main) {
  await runCli(cleanOutputs)
}
