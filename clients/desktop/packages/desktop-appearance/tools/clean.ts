/** @fileoverview Removes the visual package's declared output after its consumers stop. */

import { removeOutputs } from '@kisaki3/tooling/output'
import { resolve } from 'node:path'
import { runCli } from '@kisaki3/tooling/cli'

/** Removes the package's dist and out outputs after consumers have stopped. */
export function cleanOutput(signal?: AbortSignal): Promise<void> {
  return removeOutputs(resolve(import.meta.dirname, '..'), ['dist', 'out'], signal)
}

if (import.meta.main) {
  await runCli(cleanOutput)
}
