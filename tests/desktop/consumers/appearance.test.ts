/** @fileoverview Exercises the packed appearance library from an independent Node and browser project. */

import { afterAll, beforeAll, expect, test } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { build, preview, version as viteVersion } from 'vite'
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
  const receipt = JSON.parse(
    await readFile('artifacts/desktop/packages/packages.json', 'utf8'),
  ) as {
    packages: { name: string; file: string; sha256: string }[]
  }
  const artifact = receipt.packages.find((item) => item.name === '@kisaki3/desktop-appearance')
  if (!artifact) {
    throw new Error('Build and pack desktop public packages before running consumers')
  }
  const tarball = resolve('artifacts/desktop/packages', artifact.file)
  expect(
    createHash('sha256')
      .update(await readFile(tarball))
      .digest('hex'),
  ).toBe(artifact.sha256)

  const workspace = JSON.parse(await readFile('package.json', 'utf8')) as {
    packageManager: string
    devDependencies: Record<string, string>
  }
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({
      name: 'appearance-consumer',
      private: true,
      type: 'module',
      packageManager: workspace.packageManager,
      dependencies: { '@kisaki3/desktop-appearance': `file:${tarball.replaceAll('\\', '/')}` },
      devDependencies: {
        tailwindcss: workspace.devDependencies.tailwindcss,
        vite: viteVersion,
      },
    }),
  )
  await writeFile(join(directory, 'pnpm-workspace.yaml'), 'autoInstallPeers: false\n')
  await readPnpm(['install', '--ignore-scripts'], directory)

  const compilerOptions = {
    target: 'ES2023',
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    types: [],
    lib: ['ES2023'],
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
  }
  for (const module of ['NodeNext', 'ESNext']) {
    await writeFile(
      join(directory, `tsconfig.${module.toLowerCase()}.json`),
      JSON.stringify({
        compilerOptions: {
          ...compilerOptions,
          module,
          moduleResolution: module === 'NodeNext' ? 'NodeNext' : 'Bundler',
        },
        include: ['consumer.ts'],
      }),
    )
  }
  await writeFile(
    join(directory, 'tsconfig.browser.json'),
    JSON.stringify({
      compilerOptions: {
        ...compilerOptions,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        lib: ['ES2023', 'DOM'],
        types: ['vite/client'],
      },
      include: ['browser.ts'],
    }),
  )
  await writeFile(
    join(directory, 'tsconfig.json'),
    JSON.stringify({
      files: [],
      references: [{ path: './tsconfig.nodenext.json' }, { path: './tsconfig.browser.json' }],
    }),
  )
  await writeFile(
    join(directory, 'consumer.ts'),
    `/** @fileoverview Consumes only public artifact declarations and pure values. */
import { tokens } from '@kisaki3/desktop-appearance/tokens'
import type { TokenValues, VisualTokenName, FontTokenName } from '@kisaki3/desktop-appearance/tokens'
import { defaults } from '@kisaki3/desktop-appearance/defaults'
import { parseTokenValue, parseTokenValues } from '@kisaki3/desktop-appearance/values'
const values: TokenValues = parseTokenValues(defaults.dark)
const visual: VisualTokenName = '--ring'
const font: FontTokenName = '--font-sans'
export const sample = [tokens[visual], values[font], parseTokenValue('--radius', '0')]
`,
  )
  await writeFile(
    join(directory, 'index.html'),
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Appearance consumer</title></head>
<body><main><h1>Appearance</h1><p>独立视觉包 · Aa 0123</p>
<button id="ordinary">Plain CSS</button><button id="mapped" class="bg-primary text-primary-foreground rounded-md shadow-raised font-sans text-sm h-7">Tailwind</button>
<div id="pane" class="bg-background border border-border rounded-lg">Surface</div>
<pre id="code" class="font-mono">const theme = 'Kisaki'</pre></main>
<script type="module" src="/browser.ts"></script></body></html>`,
  )
  await writeFile(
    join(directory, 'browser.ts'),
    `/** @fileoverview Loads the artifact in a framework-free browser document. */
import '@kisaki3/desktop-appearance/styles.css'
import './utilities.css'
import './page.css'
import { defaults } from '@kisaki3/desktop-appearance/defaults'
import { tokens } from '@kisaki3/desktop-appearance/tokens'
import { parseTokenValue, parseTokenValues } from '@kisaki3/desktop-appearance/values'
const values = parseTokenValues(defaults.light)
const properties = { color: 'color', radius: 'border-radius', shadow: 'box-shadow', percentage: 'opacity', 'font-family': 'font-family', 'font-size': 'font-size', 'font-weight': 'font-weight', 'line-height': 'line-height', 'letter-spacing': 'letter-spacing' }
document.body.dataset.tokenCount = String(Object.keys(values).length)
document.body.dataset.validCss = String(Object.entries(tokens).every(([name, kind]) => CSS.supports(properties[kind], values[name as keyof typeof values])))
const checks = [
  ['--primary', 'oklch(0.6 0.2 250 / .5)'],
  ['--font-sans', '"Library Sans", sans-serif'],
  ['--shadow-raised', 'inset 0 1px 2px #0008, 0 2px 4px -1px black'],
  ['--radius', 'calc(2px + 4px)'],
  ['--primary', 'var(--foreground)'],
  ['--primary', 'currentColor'],
] as const
document.body.dataset.validation = JSON.stringify(checks.map(([name, value]) => {
  try { parseTokenValue(name, value); return true }
  catch (error) { if (!(error instanceof TypeError)) { throw error }; return false }
}))
`,
  )
  await writeFile(
    join(directory, 'page.css'),
    `/* Consumer-owned layout; the library supplies visual values. */
main { margin: 2rem; max-width: 40rem; }
button { padding: 0 1rem; border: 1px solid var(--border); }
#ordinary { background: var(--primary); color: var(--primary-foreground); border-radius: var(--radius-md); box-shadow: var(--shadow-raised); font-family: var(--font-sans); font-size: var(--text-sm); height: calc(var(--spacing) * 7); }
#pane { padding: 1rem; margin-top: 1rem; }
`,
  )
  await writeFile(
    join(directory, 'tailwind.css'),
    `@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities);
@import '@kisaki3/desktop-appearance/tailwind.css';
@source './index.html';
`,
  )
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
  for (const environment of ['nodenext', 'esnext', 'browser']) {
    await runPnpm(['exec', 'tsc', '--project', join(directory, `tsconfig.${environment}.json`)], {
      cwd: root,
    })
  }

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
      `
    import { defaults } from '@kisaki3/desktop-appearance/defaults';
    import { tokens } from '@kisaki3/desktop-appearance/tokens';
    import { parseTokenValue, parseTokenValues } from '@kisaki3/desktop-appearance/values';
    const values = parseTokenValues(defaults.light);
    const checks = [['--primary', 'oklch(0.6 0.2 250 / .5)'], ['--font-sans', '"Library Sans", sans-serif'], ['--shadow-raised', 'inset 0 1px 2px #0008, 0 2px 4px -1px black'], ['--radius', 'calc(2px + 4px)'], ['--primary', 'var(--foreground)'], ['--primary', 'currentColor']];
    const validation = checks.map(([name, value]) => {
      try { parseTokenValue(name, value); return true }
      catch (error) { if (!(error instanceof TypeError)) { throw error }; return false }
    });
    console.log(JSON.stringify({ count: Object.keys(tokens).length, radius: values['--radius'], validation }));
  `,
    ],
    { cwd: directory, windowsHide: true },
  )
  expect(JSON.parse(stdout)).toEqual({
    count: 45,
    radius: '6px',
    validation: [true, true, true, false, false, false],
  })
  const manifest = JSON.parse(
    await readFile(
      join(directory, 'node_modules/@kisaki3/desktop-appearance/package.json'),
      'utf8',
    ),
  ) as { dependencies?: unknown; sideEffects: string[] }
  expect(manifest.dependencies).toBeUndefined()
  expect(manifest.sideEffects).toContain('**/*.css')
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
