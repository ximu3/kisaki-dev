/** @fileoverview Packs the maintained desktop public packages and records their exact bytes. */

import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runCli } from '@kisaki3/tooling/cli'
import { replaceOutput } from '@kisaki3/tooling/output'
import { readPnpm } from '@kisaki3/tooling/process'

/** Pack the current workspace outputs and adopt the complete set only after every pack succeeds. */
export async function packPackages(signal?: AbortSignal): Promise<void> {
  const root = join(import.meta.dirname, '../..')
  const projects = JSON.parse(
    await readPnpm(
      ['--filter', './clients/desktop/packages/*', 'list', '--depth', '-1', '--json'],
      root,
      { signal },
    ),
  ) as { name: string; version: string; path: string }[]
  if (!projects.length) {
    throw new Error('No desktop public packages are registered')
  }

  await replaceOutput(
    root,
    'artifacts/desktop/packages',
    async (directory) => {
      const packages = []
      for (const project of projects) {
        const packed = JSON.parse(
          await readPnpm(['pack', '--pack-destination', directory, '--json'], project.path, {
            signal,
          }),
        ) as { filename: string }
        const file = basename(packed.filename)
        const bytes = await readFile(join(directory, file))
        packages.push({
          name: project.name,
          version: project.version,
          file,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        })
      }
      await writeFile(
        join(directory, 'packages.json'),
        JSON.stringify({ packages }, null, 2) + '\n',
      )
    },
    signal,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCli(packPackages)
}
