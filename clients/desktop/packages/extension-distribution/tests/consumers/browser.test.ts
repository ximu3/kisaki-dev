import { join } from 'node:path'
import { createConsumerTest, lintConsumer } from '@kisaki3/tooling/testing/consumer'
import { expect, test as base } from 'vite-plus/test'
import { build, preview } from 'vite-plus'
import { chromium } from '@playwright/test'
import { runPnpm } from '@kisaki3/tooling/process'

const test = createConsumerTest(base, join(import.meta.dirname, '../..'), 'browser')
  .extend('browser', { scope: 'file' }, async ({}, { onCleanup }) => {
    const browser = await chromium.launch()
    onCleanup(() => browser.close())
    return browser
  })
  .extend('siteUrl', { scope: 'file' }, async ({ consumerDirectory }, { onCleanup }) => {
    await build({ root: consumerDirectory, configFile: false, logLevel: 'warn' })

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
  .extend('page', async ({ browser }, { onCleanup }) => {
    const page = await browser.newPage()
    onCleanup(() => page.close())
    return page
  })

test('all pure declarations compile without Node or DOM globals', async ({
  consumerDirectory,
  signal,
}) => {
  await runPnpm(['typecheck'], { cwd: consumerDirectory, signal })
  await lintConsumer(consumerDirectory, signal)
})

test('pure entries run in Chromium without Node polyfills', async ({ page, siteUrl }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto(siteUrl)
  await page.locator('body[data-ready="true"]').waitFor()

  expect(JSON.parse((await page.textContent('body'))!)).toEqual({
    simplified: '示例',
    traditional: '範例',
    compatible: true,
    version: '1.0.0',
    url: 'https://example.org/releases/sample.kisx',
    errorCode: 'duplicate-property',
  })
  expect(errors).toEqual([])
})
