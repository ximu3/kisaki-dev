/** @fileoverview Exercises the packed appearance library from an independent Node and browser project. */

import { afterAll, beforeAll, expect, test } from 'vitest'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { build, preview } from 'vite'
import type { PreviewServer } from 'vite'
import { chromium } from '@playwright/test'
import type { Browser } from '@playwright/test'
import { ESLint } from 'eslint'
import base from '@kisaki3/eslint-config/base'
import { readPnpm, runPnpm } from '@kisaki3/tooling/process'

const root = process.cwd()
let directory: string
let browser: Browser | undefined
let server: PreviewServer | undefined

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kisaki-appearance-consumer-'))
  await cp(resolve('tests/desktop/consumers/fixtures/appearance'), directory, { recursive: true })
  const manifestPath = join(directory, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    dependencies: Record<string, string>
  }
  const archive = resolve('clients/desktop/packages/desktop-appearance/out/package/package.tgz')
  manifest.dependencies['@kisaki3/desktop-appearance'] = `file:${archive.replaceAll('\\', '/')}`
  await writeFile(manifestPath, JSON.stringify(manifest))
  await runPnpm(['install', '--ignore-scripts'], { cwd: directory })

  await readPnpm(
    [
      'exec',
      'tailwindcss',
      '-i',
      join(directory, 'tailwind.css'),
      '-o',
      join(directory, 'utilities.css'),
    ],
    root,
  )
  await build({ root: directory, configFile: false, logLevel: 'warn' })
  server = await preview({
    root: directory,
    configFile: false,
    logLevel: 'warn',
    preview: { host: '127.0.0.1', port: 0 },
  })
  browser = await chromium.launch()
})

afterAll(async () => {
  try {
    await browser?.close()
  } finally {
    try {
      if (server) {
        await new Promise<void>((accept, reject) =>
          server!.httpServer.close((error) => (error ? reject(error) : accept())),
        )
      }
    } finally {
      if (directory) {
        await rm(directory, { recursive: true, force: true })
      }
    }
  }
})

test('the tarball exposes complete declarations in NodeNext and Bundler without private dependencies', async () => {
  await runPnpm(['typecheck'], { cwd: directory })
  await runPnpm(['build:node'], { cwd: directory })

  const lint = new ESLint({
    cwd: directory,
    overrideConfigFile: true,
    overrideConfig: [
      ...base,
      { languageOptions: { parserOptions: { tsconfigRootDir: directory } } },
    ],
  })
  const checked = await lint.lintFiles(['consumer.ts', 'browser.ts'])
  expect(checked.flatMap((item) => item.messages)).toEqual([])

  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      "import { summary } from './.cache/node/consumer.js'; console.log(JSON.stringify(summary));",
    ],
    { cwd: directory, windowsHide: true },
  )
  expect(JSON.parse(stdout)).toMatchObject({
    count: 45,
    radius: '6px',
    validation: [true, true, true, false, false, false],
  })
  expect(
    await readFile(join(directory, 'node_modules/@kisaki3/desktop-appearance/LICENSE'), 'utf8'),
  ).toContain('MIT License')
  const notices = await readFile(
    join(directory, 'node_modules/@kisaki3/desktop-appearance/dist/THIRD-PARTY-NOTICES.txt'),
    'utf8',
  )
  for (const notice of [
    'css-tree',
    'mdn-data',
    'source-map-js',
    'CC0 1.0 Universal',
    'Mozilla Foundation',
  ]) {
    expect(notices).toContain(notice)
  }
})

test('ordinary CSS works by itself, preserves document controls and has complete light and dark defaults', async () => {
  const page = await browser!.newPage()
  try {
    // Load only the public stylesheet, with no Tailwind runtime or compiled utilities.
    const css = await readFile(
      join(directory, 'node_modules/@kisaki3/desktop-appearance/dist/styles.css'),
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
  } finally {
    await page.close()
  }
})

test('Tailwind and plain CSS follow the same live values, zero radii and percentage scale', async () => {
  const page = await browser!.newPage({ viewport: { width: 900, height: 540 } })
  try {
    await page.goto(server!.resolvedUrls!.local[0]!)
    expect(await page.locator('body').getAttribute('data-token-count')).toBe('45')
    expect(await page.locator('body').getAttribute('data-valid-css')).toBe('true')
    expect(JSON.parse((await page.locator('body').getAttribute('data-validation'))!)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
    ])
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
    await page.screenshot({ path: resolve('test-results/consumers/appearance.png') })
  } finally {
    await page.close()
  }
})
