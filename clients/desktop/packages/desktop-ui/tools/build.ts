/** @fileoverview Builds the browser modules, declarations and standalone stylesheet together. */

import { join } from 'node:path'
import { copyFile, writeFile } from 'node:fs/promises'
import { build } from 'tsdown'
import { runCli } from '@kisaki3/tooling/cli'
import { replaceOutput } from '@kisaki3/tooling/output'
import { runPnpm } from '@kisaki3/tooling/process'

/** Adopt the new distribution only after both compilers and license preparation succeed. */
export async function buildPackage(signal?: AbortSignal): Promise<void> {
  const project = join(import.meta.dirname, '..')
  await replaceOutput(
    project,
    'dist',
    async (outDir) => {
      await build({ cwd: project, outDir })
      await runPnpm(
        [
          'exec',
          'tailwindcss',
          '-i',
          'src/styles.css',
          '-o',
          join(outDir, 'styles.css'),
          '--minify',
        ],
        { cwd: project, signal },
      )
      await writeFile(join(outDir, 'styles.d.ts'), 'export {}\n')
      await copyFile(
        join(project, 'node_modules/@unovis/ts/LICENSE'),
        join(outDir, 'UNOVIS-LICENSE'),
      )
      await copyFile(
        join(project, 'node_modules/tailwindcss/LICENSE'),
        join(outDir, 'TAILWIND-LICENSE'),
      )
    },
    signal,
  )
}

if (import.meta.main) {
  await runCli(buildPackage)
}
