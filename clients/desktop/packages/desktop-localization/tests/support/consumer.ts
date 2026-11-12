/** @fileoverview Installs separate Node/browser consumers from the localization package and its packed dependencies. */

import { test } from 'vitest'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { ESLint } from 'eslint'
import base from '@kisaki3/eslint-config/base'
import { runPnpm } from '@kisaki3/tooling/process'

const packageRoot = resolve(import.meta.dirname, '../..')

/**
 * Creates a file-scoped fixture using the localization tarball and its packed public dependencies.
 *
 * Consumer overrides resolve unpublished dependencies to their prepared archives. Directory cleanup
 * is registered before preparation.
 */
export function consumerTest(scenario: 'node' | 'browser') {
  return test.extend('consumerDirectory', { scope: 'file' }, async ({}, { onCleanup }) => {
    const consumerDirectory = await mkdtemp(join(tmpdir(), `kisaki-localization-${scenario}-`))
    onCleanup(() => rm(consumerDirectory, { recursive: true, force: true }))

    await cp(join(packageRoot, 'tests/fixtures/consumers', scenario), consumerDirectory, {
      recursive: true,
    })

    const manifestPath = join(consumerDirectory, 'package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      dependencies: Record<string, string>
    }
    manifest.dependencies['@kisaki3/desktop-localization'] =
      `file:${join(packageRoot, 'out/package/package.tgz').replaceAll('\\', '/')}`
    const configuration = {
      overrides: Object.fromEntries(
        ['desktop-contracts', 'desktop-appearance', 'extension-distribution'].map((name) => [
          `@kisaki3/${name}`,
          `file:${join(packageRoot, '..', name, 'out/package/package.tgz').replaceAll('\\', '/')}`,
        ]),
      ),
    }
    await writeFile(manifestPath, JSON.stringify(manifest))
    await writeFile(join(consumerDirectory, 'pnpm-workspace.yaml'), JSON.stringify(configuration))

    await runPnpm(['install', '--ignore-scripts'], { cwd: consumerDirectory })

    return consumerDirectory
  })
}

/** Lints consumer sources against their installed dependencies and actual TypeScript project. */
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
