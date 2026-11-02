/** @fileoverview Exercises packed declarations, values and styles in an independent browser project. */

import { expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { build, preview } from 'vite'
import { chromium } from '@playwright/test'
import { readPnpm, runPnpm } from '@kisaki3/tooling/process'
import { consumerTest, lintConsumer } from '../support/consumer'

const packageRoot = resolve(import.meta.dirname, '../..')

const test = consumerTest('browser')
  .extend('browser', { scope: 'file' }, async ({}, { onCleanup }) => {
    const browser = await chromium.launch()
    onCleanup(() => browser.close())
    return browser
  })
  .extend('page', async ({ browser }, { onCleanup }) => {
    const page = await browser.newPage({ viewport: { width: 900, height: 540 } })
    onCleanup(() => page.close())
    return page
  })
  .extend('siteUrl', { scope: 'file' }, async ({ consumerDirectory }, { onCleanup }) => {
    await readPnpm(
      [
        'exec',
        'tailwindcss',
        '-i',
        join(consumerDirectory, 'tailwind.css'),
        '-o',
        join(consumerDirectory, 'utilities.css'),
      ],
      packageRoot,
    )
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

test('Bundler declarations work with and without browser globals', async ({
  consumerDirectory,
  signal,
}) => {
  await runPnpm(['typecheck'], { cwd: consumerDirectory, signal })
  expect((await lintConsumer(consumerDirectory)).flatMap((item) => item.messages)).toEqual([])
})

test('ordinary CSS works by itself, preserves document controls and has complete light and dark defaults', async ({
  consumerDirectory,
  page,
}) => {
  // Load only the public stylesheet, with no Tailwind runtime or compiled utilities.
  const css = await readFile(
    join(consumerDirectory, 'node_modules/@kisaki3/desktop-appearance/dist/styles.css'),
    'utf8',
  )
  await page.setContent(
    '<!doctype html><html><body><button>Focus</button><p>Text</p></body></html>',
  )
  await page.addStyleTag({ content: css })
  expect(await page.locator('html').evaluate((node) => getComputedStyle(node).fontSize)).toBe(
    '14px',
  )
  expect(await page.locator('body').evaluate((node) => getComputedStyle(node).margin)).toBe('8px')
  await page.keyboard.press('Tab')
  expect(
    await page.locator('button').evaluate((node) => getComputedStyle(node).outlineStyle),
  ).not.toBe('none')
  for (const scheme of ['light', 'dark']) {
    await page
      .locator('html')
      .evaluate((node, value) => node.setAttribute('data-color-scheme', value), scheme)
    const actual = await page.locator('html').evaluate((node) => {
      const style = getComputedStyle(node)
      return {
        scheme: style.colorScheme,
        background: style.backgroundColor,
        shadow: style.getPropertyValue('--shadow-modal'),
      }
    })
    expect(actual.scheme).toBe(scheme)
    expect(actual.background).toContain('oklch(')
    expect(actual.shadow).toContain('inset')
  }
})

test('Tailwind and plain CSS follow the same live values, zero radii and percentage scale', async ({
  siteUrl,
  page,
}) => {
  await page.goto(siteUrl)
  expect(await page.locator('body').getAttribute('data-token-count')).toBe('45')
  expect(await page.locator('body').getAttribute('data-valid-css')).toBe('true')
  for (const scheme of ['light', 'dark']) {
    await page
      .locator('html')
      .evaluate((node, value) => node.setAttribute('data-color-scheme', value), scheme)
    const pair = await page.locator('button').evaluateAll((nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node)
        return {
          color: style.color,
          background: style.backgroundColor,
          radius: style.borderRadius,
          font: style.fontFamily,
          size: style.fontSize,
          height: style.height,
        }
      }),
    )
    expect(pair[0]).toEqual(pair[1])
    expect(pair[1]?.radius).toBe('4px')
    expect(pair[1]?.size).toBe('12.25px')
    expect(
      await page.locator('#mapped').evaluate((node) => getComputedStyle(node).boxShadow),
    ).not.toBe('none')
  }
  await page.locator('html').evaluate((node) => {
    node.style.setProperty('--primary', 'rgb(80 120 160)')
    node.style.setProperty('--font-sans', 'monospace')
    node.style.setProperty('--radius', '0px')
    node.style.setProperty('--interface-scale', '150')
    node.style.setProperty('--shadow-raised', '1px 2px 3px rgb(10 20 30)')
  })
  const changed = await page.locator('#mapped').evaluate((node) => {
    const style = getComputedStyle(node)
    return {
      color: style.backgroundColor,
      font: style.fontFamily,
      radius: style.borderRadius,
      height: style.height,
    }
  })
  expect(changed).toEqual({
    color: 'rgb(80, 120, 160)',
    font: 'monospace',
    radius: '0px',
    height: '36.75px',
  })
  expect(
    await page.locator('#mapped').evaluate((node) => getComputedStyle(node).boxShadow),
  ).toContain('rgb(10, 20, 30) 1px 2px 3px')
  await page.screenshot({ path: join(packageRoot, 'test-results/consumers/appearance.png') })
})
