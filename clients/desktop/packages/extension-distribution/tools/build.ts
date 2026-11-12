/** @fileoverview Builds every distribution entry and declaration into the package output directory. */

import { join } from 'node:path'
import { build } from 'tsdown'
import { runCli } from '@kisaki3/tooling/cli'
import { removeOutputs } from '@kisaki3/tooling/output'

/**
 * Prepares the package's disposable dist directory and builds its public distribution.
 *
 * The caller consumes the output only after this operation succeeds.
 */
export async function buildPackage(signal?: AbortSignal): Promise<void> {
  const project = join(import.meta.dirname, '..')

  const outDir = join(project, 'dist')
  await removeOutputs(project, ['dist'], signal)

  await build({ cwd: project, outDir, clean: false })

  signal?.throwIfAborted()
}

if (import.meta.main) {
  await runCli(buildPackage)
}
