/** @fileoverview Installs the two packed visual packages in an independent, Tailwind-free Solid project. */

import { test as baseTest, expect } from 'vitest'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build, preview } from 'vite'
import solid from 'vite-plugin-solid'
import { chromium } from '@playwright/test'
import { runPnpm } from '@kisaki3/tooling/process'
import { ESLint } from 'eslint'
import base from '@kisaki3/eslint-config/base'

const project = resolve(import.meta.dirname, '../..')
export const reportDirectory = join(project, 'test-results/consumers')

export const test = baseTest
  .extend('consumer', { scope: 'file' }, async ({}, { onCleanup }) => {
    const directory = await mkdtemp(join(tmpdir(), 'kisaki-ui-'))
    onCleanup(() => rm(directory, { recursive: true, force: true }))
    await cp(join(project, 'tests/fixtures/consumers/solid'), directory, { recursive: true })
    const manifestPath = join(directory, 'package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      dependencies: Record<string, string>
    }
    manifest.dependencies['@kisaki3/desktop-ui'] =
      'file:' + join(project, 'out/package/package.tgz').replaceAll('\\', '/')
    await writeFile(manifestPath, JSON.stringify(manifest))
    await writeFile(
      join(directory, 'pnpm-workspace.yaml'),
      JSON.stringify({
        overrides: {
          '@kisaki3/desktop-appearance':
            'file:' +
            resolve(project, '../desktop-appearance/out/package/package.tgz').replaceAll('\\', '/'),
        },
      }),
    )
    await runPnpm(['install', '--ignore-scripts'], { cwd: directory })

    const installed = JSON.parse(
      await readFile(join(directory, 'node_modules/@kisaki3/desktop-ui/package.json'), 'utf8'),
    ) as { exports: Record<string, unknown> }
    const entries = Object.keys(installed.exports)
      .filter((path) => !path.endsWith('.css'))
      .map((path) => `import '@kisaki3/desktop-ui${path.slice(1)}'`)
    await writeFile(join(directory, 'public-entries.d.ts'), entries.join('\n'))
    return directory
  })
  .extend('site', { scope: 'file' }, async ({ consumer }, { onCleanup }) => {
    const output = await build({
      root: consumer,
      configFile: false,
      logLevel: 'warn',
      plugins: [solid()],
    })
    const files = (Array.isArray(output) ? output : [output]).flatMap((result) =>
      'output' in result ? result.output : [],
    )
    const chunks = files.filter((chunk) => chunk.type === 'chunk')
    const entry = chunks.find((chunk) => chunk.isEntry)!
    const initial = new Set<string>()
    function visit(name: string): void {
      if (initial.has(name)) {
        return
      }
      initial.add(name)
      for (const dependency of chunks.find((chunk) => chunk.fileName === name)?.imports ?? []) {
        visit(dependency)
      }
    }
    visit(entry.fileName)
    const initialModules = chunks
      .filter((chunk) => initial.has(chunk.fileName))
      .flatMap((chunk) => Object.keys(chunk.modules))
    expect(initialModules.join('\n')).not.toMatch(
      /@codemirror|@unovis|markdown-it|pragmatic-drag-and-drop/,
    )
    const server = await preview({
      root: consumer,
      configFile: false,
      logLevel: 'warn',
      preview: { host: '127.0.0.1', port: 0 },
    })
    onCleanup(
      () =>
        new Promise<void>((accept, reject) =>
          server.httpServer.close((err) => (err ? reject(err) : accept())),
        ),
    )
    await mkdir(reportDirectory, { recursive: true })
    return server.resolvedUrls!.local[0]!
  })
  .extend('browser', { scope: 'file' }, async ({}, { onCleanup }) => {
    const browser = await chromium.launch()
    onCleanup(() => browser.close())
    return browser
  })
  .extend('page', async ({ browser, site }, { onCleanup }) => {
    const page = await browser.newPage({ viewport: { width: 960, height: 820 } })
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    onCleanup(async () => {
      await page.close()
      expect(errors).toEqual([])
    })
    page.setDefaultTimeout(7_000)
    await page.goto(site)
    return page
  })

/** Run type-aware rules using only the installed consumer's public declarations. */
export async function lintConsumer(directory: string): Promise<void> {
  const lint = new ESLint({
    cwd: directory,
    overrideConfigFile: true,
    overrideConfig: [
      ...base,
      { languageOptions: { parserOptions: { tsconfigRootDir: directory } } },
    ],
  })
  expect((await lint.lintFiles(['*.tsx'])).flatMap((result) => result.messages)).toEqual([])
}
