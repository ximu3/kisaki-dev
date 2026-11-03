/** @fileoverview Installs isolated consumer projects and checks their actual TypeScript sources. */

import { test } from 'vitest'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { ESLint } from 'eslint'
import base from '@kisaki3/eslint-config/base'
import { runPnpm } from '@kisaki3/tooling/process'

const packageRoot = resolve(import.meta.dirname, '../..')

/** Create a test API with an on-demand consumer per file, cleaned up even when preparation fails. */
export function consumerTest(scenario: 'node' | 'browser') {
  return test.extend('consumerDirectory', { scope: 'file' }, async ({}, { onCleanup }) => {
    const consumerDirectory = await mkdtemp(join(tmpdir(), `kisaki-distribution-${scenario}-`))
    onCleanup(() => rm(consumerDirectory, { recursive: true, force: true }))

    await cp(join(packageRoot, 'tests/fixtures/consumers', scenario), consumerDirectory, {
      recursive: true,
    })

    const manifestPath = join(consumerDirectory, 'package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      dependencies: Record<string, string>
    }
    const tarballPath = join(packageRoot, 'out/package/package.tgz')
    manifest.dependencies['@kisaki3/extension-distribution'] =
      `file:${tarballPath.replaceAll('\\', '/')}`
    await writeFile(manifestPath, JSON.stringify(manifest))

    await runPnpm(['install', '--ignore-scripts'], { cwd: consumerDirectory })

    return consumerDirectory
  })
}

/** Apply the repository's typed lint rules after the consumer's own dependencies are installed. */
export async function lintConsumer(directory: string): Promise<ESLint.LintResult[]> {
  const lint = new ESLint({
    cwd: directory,
    overrideConfigFile: true,
    overrideConfig: [
      ...base,
      { languageOptions: { parserOptions: { tsconfigRootDir: directory } } },
    ],
  })
  return lint.lintFiles(['*.ts'])
}
