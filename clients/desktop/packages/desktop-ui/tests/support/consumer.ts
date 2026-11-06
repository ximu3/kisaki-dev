/** @fileoverview Installs actual UI and appearance tarballs outside the repository and serves their consumer. */

import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { test, expect } from 'vitest'
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { ESLint } from 'eslint'
import base from '@kisaki3/eslint-config/base'
import { runPnpm } from '@kisaki3/tooling/process'

export const packageRoot = resolve(import.meta.dirname, '../..')

/** A file-scoped isolated installation; every browser and server closes before the directory is removed. */
export const consumerTest = test
  .extend('consumerDirectory', { scope: 'file' }, async ({}, { onCleanup }) => {
    const directory = await mkdtemp(join(tmpdir(), 'kisaki-ui-consumer-'))
    onCleanup(() => rm(directory, { recursive: true, force: true }))
    await cp(join(packageRoot, 'tests/fixtures/consumers/browser'), directory, { recursive: true })

    const manifestPath = join(directory, 'package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      dependencies: Record<string, string>
    }
    manifest.dependencies['@kisaki3/desktop-ui'] =
      `file:${join(packageRoot, 'out/package/package.tgz').replaceAll('\\', '/')}`
    const appearance = join(
      packageRoot,
      '../desktop-appearance/out/package/package.tgz',
    ).replaceAll('\\', '/')
    manifest.dependencies['@kisaki3/desktop-appearance'] = `file:${appearance}`
    await writeFile(manifestPath, JSON.stringify(manifest))
    await writeFile(
      join(directory, 'pnpm-workspace.yaml'),
      `autoInstallPeers: false\noverrides:\n  '@kisaki3/desktop-appearance': 'file:${appearance}'\n`,
    )

    await runPnpm(['install', '--ignore-scripts'], { cwd: directory })

    return directory
  })
  .extend('siteUrl', { scope: 'file' }, async ({ consumerDirectory }, { onCleanup }) => {
    await runPnpm(['build'], { cwd: consumerDirectory })
    const server = await preview({
      root: consumerDirectory,
      configFile: false,
      logLevel: 'warn',
      preview: { host: '127.0.0.1', port: 0 },
    })
    onCleanup(
      () =>
        new Promise<void>((accept, reject) =>
          server.httpServer.close((error) => (error ? reject(error) : accept())),
        ),
    )

    return server.resolvedUrls!.local[0]!
  })
  .extend('browser', { scope: 'file' }, async ({}, { onCleanup }) => {
    const browser = await chromium.launch()
    onCleanup(() => browser.close())

    const archive = await readFile(join(packageRoot, 'out/package/package.tgz'))
    await writeFile(
      join(packageRoot, 'test-results/consumers/environment.json'),
      JSON.stringify(
        {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          chromium: browser.version(),
          packageSha256: createHash('sha256').update(archive).digest('hex'),
        },
        null,
        2,
      ),
    )

    return browser
  })
  .extend('page', async ({ browser, siteUrl }, { onCleanup }) => {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    onCleanup(async () => {
      await page.close()
      expect(errors).toEqual([])
    })

    await page.goto(siteUrl)
    return page
  })

/** Full type-aware rules run against installed consumer declarations, including its TSX source. */
export async function lintConsumer(directory: string): Promise<void> {
  const lint = new ESLint({
    cwd: directory,
    overrideConfigFile: true,
    overrideConfig: [
      ...base,
      { languageOptions: { parserOptions: { tsconfigRootDir: directory } } },
    ],
  })
  expect((await lint.lintFiles(['*.ts', '*.tsx'])).flatMap((result) => result.messages)).toEqual([])
}
