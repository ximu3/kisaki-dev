/** @fileoverview Installs packed workspace packages in an independent consumer and owns its temporary directory. */

import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stringify } from 'yaml'
import { run, runPnpm } from '../process/index.ts'

/** Creates a real external installation, registering cleanup before copying any fixture files. */
export async function installConsumer(
  fixture: string,
  archives: Readonly<Record<string, string>>,
  cleanup: (dispose: () => Promise<void>) => void,
  signal?: AbortSignal,
): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'kisaki-package-consumer-'))
  cleanup(() => rm(directory, { recursive: true, force: true }))
  await cp(fixture, directory, { recursive: true })

  const file = join(directory, 'package.json')
  const manifest = JSON.parse(await readFile(file, 'utf8')) as {
    dependencies: Record<string, string>
  }
  const overrides: Record<string, string> = {}
  for (const [name, archive] of Object.entries(archives)) {
    const source = `file:${archive.replaceAll('\\', '/')}`
    overrides[name] = source
    if (Object.hasOwn(manifest.dependencies, name)) {
      manifest.dependencies[name] = source
    }
  }
  await writeFile(file, JSON.stringify(manifest))
  await writeFile(
    join(directory, 'pnpm-workspace.yaml'),
    stringify({ autoInstallPeers: false, overrides }),
  )
  await runPnpm(['install', '--no-frozen-lockfile', '--ignore-scripts'], { cwd: directory, signal })
  return directory
}

/** Runs typed lint against the installed package graph and the consumer's own TypeScript projects. */
export async function lintConsumer(directory: string, signal?: AbortSignal): Promise<void> {
  const bin = join(dirname(fileURLToPath(import.meta.resolve('vite-plus/package.json'))), 'bin/vp')
  const sources = (await readdir(directory)).filter((name) => /\.tsx?$/.test(name))
  await run(
    process.execPath,
    [
      bin,
      'lint',
      '--type-aware',
      '-D',
      'typescript/no-unsafe-argument',
      '-D',
      'typescript/no-floating-promises',
      ...sources,
    ],
    { cwd: directory, signal },
  )
}
