/** @fileoverview Owns the independent UI consumer, its preview server and its browser resources. */

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { test, expect } from 'vite-plus/test'
import { chromium } from '@playwright/test'
import { preview } from 'vite-plus'
import { runPnpm } from '@kisaki3/tooling/process'
import { join, resolve } from 'node:path'
import { installConsumer } from '@kisaki3/tooling/testing/consumer'

/** This package's root and completed distribution artifacts. */
export const packageRoot = resolve(import.meta.dirname, '../..')

/** The checked tarballs belonging to this external consumer. */
const archives = {
  '@kisaki3/desktop-ui': join(packageRoot, 'out/package/package.tgz'),
  '@kisaki3/desktop-appearance': join(packageRoot, '../desktop-appearance/out/package/package.tgz'),
}

/** Isolates installation, browser pages and evidence for the public UI consumer. */
export const consumerTest = test
  .extend('resultsDirectory', { scope: 'file' }, async () => {
    const directory = join(packageRoot, 'test-results/consumers')
    await mkdir(directory, { recursive: true })
    return directory
  })
  .extend('consumerDirectory', { scope: 'file' }, async ({}, { onCleanup }) => {
    const directory = await installConsumer(
      join(import.meta.dirname, 'fixtures/browser'),
      archives,
      onCleanup,
    )
    await cp(join(packageRoot, 'tests/fixtures/workshop'), directory, { recursive: true })
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
  .extend('browser', { scope: 'file' }, async ({ resultsDirectory }, { onCleanup }) => {
    const browser = await chromium.launch()
    onCleanup(() => browser.close())

    const archive = await readFile(join(packageRoot, 'out/package/package.tgz'))
    await writeFile(
      join(resultsDirectory, 'environment.json'),
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
