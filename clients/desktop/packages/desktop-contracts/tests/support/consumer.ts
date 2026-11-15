/** @fileoverview Installs separate Node/browser consumers from the actual contract and public dependency tarballs. */

import { test } from 'vitest'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { ESLint } from 'eslint'
import base from '@kisaki3/eslint-config/base'
import { runPnpm } from '@kisaki3/tooling/process'

/** Contracts package root whose completed tarball supplies isolated consumer fixtures. */
const packageRoot = resolve(import.meta.dirname, '../..')

/**
 * Creates a file-scoped fixture that installs packed contracts and dependencies in an isolated
 * consumer.
 *
 * Cleanup removes the temporary workspace, and generated imports include every published
 * declaration entry.
 */
export function consumerTest(scenario: 'node' | 'browser') {
  return test.extend('consumerDirectory', { scope: 'file' }, async ({}, { onCleanup }) => {
    const consumerDirectory = await mkdtemp(join(tmpdir(), `kisaki-contracts-${scenario}-`))
    onCleanup(() => rm(consumerDirectory, { recursive: true, force: true }))

    await cp(join(packageRoot, 'tests/fixtures/consumers', scenario), consumerDirectory, {
      recursive: true,
    })

    const manifestPath = join(consumerDirectory, 'package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      dependencies: Record<string, string>
    }
    manifest.dependencies['@kisaki3/desktop-contracts'] =
      `file:${join(packageRoot, 'out/package/package.tgz').replaceAll('\\', '/')}`
    const configuration = {
      overrides: Object.fromEntries(
        ['desktop-appearance', 'extension-distribution'].map((name) => [
          `@kisaki3/${name}`,
          `file:${join(packageRoot, '..', name, 'out/package/package.tgz').replaceAll('\\', '/')}`,
        ]),
      ),
    }
    await writeFile(manifestPath, JSON.stringify(manifest))
    await writeFile(join(consumerDirectory, 'pnpm-workspace.yaml'), JSON.stringify(configuration))

    await runPnpm(['install', '--ignore-scripts'], { cwd: consumerDirectory })

    // Include every published declaration through the same package resolution used by the consumer.
    const installed = JSON.parse(
      await readFile(
        join(consumerDirectory, 'node_modules/@kisaki3/desktop-contracts/package.json'),
        'utf8',
      ),
    ) as { name: string; exports: Record<string, unknown> }
    const imports = Object.keys(installed.exports).map(
      (subpath) => `import '${installed.name}${subpath.slice(1)}'`,
    )
    await writeFile(join(consumerDirectory, 'public-entries.d.ts'), imports.join('\n'))

    return consumerDirectory
  })
}

/** Lints the consumer using its own type project and installed package declarations. */
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
