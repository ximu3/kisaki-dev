/** @fileoverview Installs the checked tarball into an external project and builds its real consumer sources. */

import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { ESLint } from 'eslint'
import { expect, onTestFinished } from 'vitest'
import base from '@kisaki3/eslint-config/base'
import { runPnpm } from '@kisaki3/tooling/process'

const root = resolve(import.meta.dirname, '../..')

/** Each host owns its type environment and data directory, removed after the process finishes. */
export async function prepareConsumer(
  host: 'node' | 'electron',
  signal: AbortSignal,
): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), `kisaki-rpc-${host}-`))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))
  await cp(join(root, 'tests/fixtures/consumers', host), directory, { recursive: true })

  const manifestPath = join(directory, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    dependencies: Record<string, string>
  }
  manifest.dependencies['@kisaki3/desktop-rpc'] =
    `file:${join(root, 'out/package/package.tgz').replaceAll('\\', '/')}`
  await writeFile(manifestPath, JSON.stringify(manifest))
  await runPnpm(['install', '--ignore-scripts'], { cwd: directory, signal })
  await runPnpm(['build'], { cwd: directory, signal })

  const lint = new ESLint({
    cwd: directory,
    overrideConfigFile: true,
    overrideConfig: [
      ...base,
      { languageOptions: { parserOptions: { tsconfigRootDir: directory } } },
    ],
  })
  expect((await lint.lintFiles(['*.ts'])).flatMap((result) => result.messages)).toEqual([])
  return directory
}
