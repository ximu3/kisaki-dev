/** @fileoverview Serves the editable component workshop and owns a fresh Chromium page for each case. */

import { test as base, expect } from 'vite-plus/test'
import { createServer, defaultClientConditions } from 'vite-plus'
import { chromium } from '@playwright/test'
import solid from 'vite-plugin-solid'
import { resolve } from 'node:path'

/** Launches the shared source workshop and browser, isolating each test's page state. */
export const test = base
  .extend('siteUrl', { scope: 'file' }, async ({}, { onCleanup }) => {
    const server = await createServer({
      configFile: false,
      root: resolve(import.meta.dirname, '../fixtures/workshop'),
      resolve: { conditions: ['kisaki-source', ...defaultClientConditions], dedupe: ['solid-js'] },
      plugins: [solid()],
      server: { host: '127.0.0.1', port: 0 },
      logLevel: 'warn',
    })
    onCleanup(() => server.close())
    await server.listen()
    return server.resolvedUrls!.local[0]!
  })
  .extend('browser', { scope: 'file' }, async ({}, { onCleanup }) => {
    const browser = await chromium.launch()
    onCleanup(() => browser.close())
    return browser
  })
  .extend('page', async ({ siteUrl, browser }, { onCleanup }) => {
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
