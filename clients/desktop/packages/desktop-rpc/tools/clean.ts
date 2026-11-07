/** @fileoverview Removes this package's generated distribution and tarball outputs. */

import { removeOutputs } from '@kisaki3/tooling/output'
import { resolve } from 'node:path'
import { runCli } from '@kisaki3/tooling/cli'

/** Remove the distribution and archive after consumers stop. */
export function cleanOutput(signal?: AbortSignal): Promise<void> {
  return removeOutputs(resolve(import.meta.dirname, '..'), ['dist', 'out'], signal)
}

if (import.meta.main) {
  await runCli(cleanOutput)
}
