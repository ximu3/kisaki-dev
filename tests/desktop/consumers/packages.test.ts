/**
 * @fileoverview Verifies installed desktop tarballs through declaration and typed-lint
 * checks, Node execution and real browser consumers.
 */

import { afterAll, beforeAll, expect, test } from 'vitest'
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { ESLint } from 'eslint'
import lintConfig from '@kisaki3/eslint-config/base'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { consumerCommand, prepareConsumer } from '../support/consumer'

let consumer: Awaited<ReturnType<typeof prepareConsumer>>

beforeAll(async () => {
  consumer = await prepareConsumer()
})

afterAll(async () => {
  await consumer?.close()
})

test('strict declarations, typed lint and Node consume the supplied public entries outside the repository', async () => {
  await consumerCommand(consumer.directory, ['run', 'typecheck'])

  const lint = new ESLint({
    cwd: consumer.directory,
    overrideConfigFile: true,
    overrideConfig: [
      ...lintConfig,
      { languageOptions: { parserOptions: { tsconfigRootDir: consumer.directory } } },
    ],
  })
  const results = await lint.lintFiles(['node', 'webview', 'solid', 'vite.config.ts'])
  expect(results.length).toBeGreaterThan(0)
  for (const result of results) {
    expect(result.messages, result.filePath).toEqual([])
  }

  expect(await consumerCommand(consumer.directory, ['run', 'test:node'])).toContain(
    'consumer-ready',
  )

  const manifest = await readFile(join(consumer.directory, 'package.json'), 'utf8')
  expect(manifest).not.toContain('workspace:')
  expect(manifest).not.toContain('tailwindcss')
})

test('framework-independent and Solid pages consume built styles without a Tailwind toolchain', async () => {
  await consumerCommand(consumer.directory, ['run', 'build'])

  const server = await preview({
    root: consumer.directory,
    configFile: false,
    preview: { host: '127.0.0.1', port: 0 },
  })
  try {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      const url = server.resolvedUrls?.local[0]
      if (!url) {
        throw new Error('Consumer preview has no listening address')
      }

      await page.goto(new URL('webview/index.html', url).href)
      expect(await page.locator('h1').textContent()).toBe('Framework-independent consumer')

      const themes = await page.evaluate(() => {
        const root = document.documentElement
        const expected = JSON.parse(root.dataset.tokens!) as {
          light: Record<string, string>
          dark: Record<string, string>
        }

        const probe = document.createElement('span')
        document.body.append(probe)

        const color = (value: string) => {
          probe.style.color = value
          return getComputedStyle(probe).color
        }
        const read = (tokens: Record<string, string>) => {
          const style = getComputedStyle(root)
          const missing = Object.keys(tokens).filter(
            (name) => style.getPropertyValue(name).trim() === '',
          )
          const names = ['--background', '--foreground', '--primary', '--primary-foreground']

          return {
            missing,
            colors: names.map((name) => color(`var(${name})`)),
            expectedColors: names.map((name) => color(tokens[name]!)),
          }
        }

        // The consumer's CSS optimizer may rewrite equivalent color syntax.
        const light = read(expected.light)

        root.dataset.colorScheme = 'dark'
        const dark = read(expected.dark)

        probe.remove()

        return { light, dark }
      })
      expect(themes.light.missing).toEqual([])
      expect(themes.dark.missing).toEqual([])
      expect(themes.light.colors).toEqual(themes.light.expectedColors)
      expect(themes.dark.colors).toEqual(themes.dark.expectedColors)

      await page.goto(new URL('solid/index.html', url).href)
      await page.getByRole('button', { name: 'Count 0' }).click()
      expect(await page.getByRole('button', { name: 'Count 1' }).count()).toBe(1)

      expect(
        await page
          .getByRole('button')
          .evaluate((element) => getComputedStyle(element).borderRadius),
      ).toBe('6px')

      // A package stylesheet must not impose a document reset on unrelated author content.
      expect(
        await page.locator('h1').evaluate((element) => getComputedStyle(element).fontSize),
      ).toBe('32px')
    } finally {
      await browser.close()
    }
  } finally {
    await server.close()
  }
})
