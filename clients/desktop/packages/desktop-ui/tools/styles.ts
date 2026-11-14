/** @fileoverview Assembles the published UI stylesheet and notices after component compilation. */

import { readFile, writeFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCli } from '@kisaki3/tooling/cli'

/**
 * Assembles the cascade-ordered stylesheet and notices in the completed package output.
 *
 * The caller consumes the output only after this operation succeeds.
 */
export async function assembleStyles(signal?: AbortSignal): Promise<void> {
  const project = join(import.meta.dirname, '..')
  const outDir = join(project, 'dist')
  signal?.throwIfAborted()
  const [base, appearance, components] = await Promise.all([
    readFile(join(project, 'src/styles.css'), 'utf8'),
    readFile(fileURLToPath(import.meta.resolve('@kisaki3/desktop-appearance/styles.css')), 'utf8'),
    readFile(join(outDir, 'components.css'), 'utf8'),
  ])
  const styles = base.replace("@import '@kisaki3/desktop-appearance/styles.css';", () => appearance)
  await writeFile(join(outDir, 'styles.css'), styles + '\n' + components)
  await rm(join(outDir, 'components.css'))

  const notices = []
  for (const name of ['@unovis/solid', '@unovis/ts']) {
    const directory = dirname(fileURLToPath(import.meta.resolve(name)))
    const { version } = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as {
      version: string
    }
    notices.push(
      `${name} ${version} — bundled declarations\n\n${await readFile(join(directory, 'LICENSE'), 'utf8')}`,
    )
  }
  await writeFile(join(outDir, 'THIRD-PARTY-NOTICES.txt'), notices.join('\n\n'))

  signal?.throwIfAborted()
}

if (import.meta.main) {
  await runCli(assembleStyles)
}
