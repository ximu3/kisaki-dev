/** @fileoverview Removes the visual package's declared output after its consumers stop. */

import { removeOutputs } from '@kisaki3/tooling/output'
import { resolve } from 'node:path'
import { runCli } from '@kisaki3/tooling/cli'

/** Remove this project's compiled files and tarball; retain source and build caches. */
export function cleanOutput(signal?: AbortSignal): Promise<void> {
  return removeOutputs(resolve(import.meta.dirname, '..'), ['dist', 'out'], signal)
}

if (import.meta.main) {
  await runCli(cleanOutput)
}
