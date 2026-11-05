/** @fileoverview Checks packed desktop contracts in a browser type environment, a document and an iframe. */

import { expect } from 'vitest'
import { join } from 'node:path'
import { build, preview } from 'vite'
import { chromium } from '@playwright/test'
import { runPnpm } from '@kisaki3/tooling/process'
import { consumerTest, lintConsumer } from '../support/consumer'

const test = consumerTest('browser')
  .extend('browser', { scope: 'file' }, async ({}, { onCleanup }) => {
    const browser = await chromium.launch()
    onCleanup(() => browser.close())
    return browser
  })
  .extend('siteUrl', { scope: 'file' }, async ({ consumerDirectory }, { onCleanup }) => {
    await build({
      root: consumerDirectory,
      configFile: false,
      logLevel: 'warn',
      build: {
        rolldownOptions: {
          input: {
            main: join(consumerDirectory, 'index.html'),
            view: join(consumerDirectory, 'view.html'),
          },
        },
      },
    })

    const server = await preview({
      root: consumerDirectory,
      configFile: false,
      logLevel: 'warn',
      preview: { host: '127.0.0.1', port: 0 },
    })
    onCleanup(
      () =>
        new Promise<void>((resolve, reject) =>
          server.httpServer.close((error) => (error ? reject(error) : resolve())),
        ),
    )

    return server.resolvedUrls!.local[0]!
  })
  .extend('page', async ({ browser }, { onCleanup }) => {
    const page = await browser.newPage()
    onCleanup(() => page.close())
    return page
  })

test('browser globals support the published desktop contracts', async ({
  consumerDirectory,
  signal,
}) => {
  await runPnpm(['typecheck'], { cwd: consumerDirectory, signal })

  expect((await lintConsumer(consumerDirectory)).flatMap((item) => item.messages)).toEqual([])
})

test('links and locales run in the main document and catalog values run in an iframe', async ({
  page,
  siteUrl,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto(siteUrl)
  await page.locator('body[data-ready="true"]').waitFor()

  expect(JSON.parse((await page.locator('#summary').textContent())!)).toEqual({
    locale: 'zh-Hans-CN',
    link: 'kisaki://view/anime/external/bangumi/subject%2F123',
  })

  await page.frameLocator('#view').locator('body[data-ready="true"]').waitFor()

  expect(await page.frameLocator('#view').locator('body').textContent()).toBe(
    '{"literal":"<b>{literal}</b>"}',
  )

  expect(errors).toEqual([])
})
