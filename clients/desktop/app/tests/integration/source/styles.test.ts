import { expect, onTestFailed, onTestFinished, test, vi } from 'vite-plus/test'
import { expect as browserExpect } from '@playwright/test'
import { chromium } from 'playwright'
import type { HotPayload } from 'vite'
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { appRoot } from '../../../tools/lib/paths'
import { createRenderer } from '../../../tools/dev/renderer/server'
import { windowKinds } from '../../../src/shared/window-api/protocol'

async function stylePackage(root: string, name: string, styles: Readonly<Record<string, string>>) {
  const directory = join(root, 'packages', name)
  const scope = join(root, 'node_modules', '@kisaki3')
  const exports: Record<string, Record<string, string>> = {}
  await Promise.all(
    ['src', 'dist'].map((part) => mkdir(join(directory, part), { recursive: true })),
  )
  for (const [file, source] of Object.entries(styles)) {
    exports['./' + file] = { 'kisaki-source': './src/' + file, default: './dist/' + file }
    await writeFile(join(directory, 'src', file), source)
    await writeFile(join(directory, 'dist', file), ':root { --stale-style: yes; }')
  }
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ name: '@kisaki3/' + name, exports }),
  )
  await mkdir(scope, { recursive: true })
  await symlink(directory, join(scope, name), process.platform === 'win32' ? 'junction' : 'dir')
  return directory
}

test('source styles and live updates survive gaps in independent public package builds', async () => {
  const parent = join(appRoot, '.cache')
  await mkdir(parent, { recursive: true })
  const root = await mkdtemp(join(parent, 'renderer-styles-'))
  onTestFinished(() => rm(root, { recursive: true, force: true, maxRetries: 4 }))
  const config = 'config/vite/renderer.ts'
  await mkdir(join(root, 'config/vite'), { recursive: true })
  await copyFile(join(appRoot, config), join(root, config))

  const windows = join(root, 'src/renderer/windows')
  for (const kind of windowKinds) {
    const directory = join(windows, kind)
    await mkdir(directory, { recursive: true })
    const html =
      kind === 'main'
        ? '<!doctype html><link rel="stylesheet" href="./styles.css"><main class="flex">Sample</main>'
        : '<!doctype html><title>Window fixture</title>'
    await writeFile(join(directory, 'index.html'), html)
  }

  const ui = await stylePackage(root, 'desktop-ui', {
    'styles.css': '@import "@kisaki3/desktop-appearance/styles.css";\nmain { padding-left: 7px; }',
  })
  const appearance = await stylePackage(root, 'desktop-appearance', {
    'styles.css': 'main { padding-right: 11px; }',
    'tailwind.css': 'main { padding-bottom: 13px; }',
  })
  await writeFile(
    join(windows, 'main/styles.css'),
    [
      '@import "tailwindcss" source(none);',
      '@import "@kisaki3/desktop-appearance/tailwind.css";',
      '@import "@kisaki3/desktop-ui/styles.css";',
      '@source "./index.html";',
    ].join('\n'),
  )

  const stylesheet = join(appearance, 'src/styles.css')
  const events: string[] = []
  const record = (event: string) => events.push(new Date().toISOString() + ' ' + event)
  onTestFailed(async () => {
    const log = events.join('\n') + '\n'
    console.error(log)
    const directory = join(appRoot, 'test-results', 'dev-session')
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'source-styles.log'), log)
  })

  const server = await createRenderer(root, 'stylesheet-test', join(root, 'vite-cache'))
  onTestFinished(() => server.close())
  const broadcasts = vi.spyOn(server.environments.client.hot, 'send')
  onTestFinished(() => {
    for (const [message] of broadcasts.mock.calls) {
      events.push('Server broadcast: ' + JSON.stringify(message))
    }
    broadcasts.mockRestore()
  })
  server.watcher.on('all', (event, file) => {
    if (resolve(file) === stylesheet) {
      record('watcher ' + event + ' ' + basename(file))
    }
  })
  await server.listen()
  const browser = await chromium.launch()
  onTestFinished(() => browser.close())
  const page = await browser.newPage()
  let connected = false
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      const message = JSON.parse(String(payload)) as HotPayload
      if (message.type === 'connected') {
        connected = true
        record('HMR connected')
      } else if (message.type === 'update') {
        for (const update of message.updates) {
          record(update.type + ' ' + update.path)
        }
      } else {
        record('HMR ' + message.type)
      }
    })
    socket.on('close', () => {
      connected = false
      record('HMR disconnected')
    })
  })
  page.on('pageerror', (error) => record(error.message))
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.endsWith('.css')) {
      record('CSS response ' + response.status() + ' ' + new URL(response.url()).pathname)
    }
  })
  await page.goto(new URL('main/index.html', server.resolvedUrls!.local[0]).href)
  const sample = page.locator('main')
  const metrics = () =>
    sample.evaluate((element) => {
      const style = getComputedStyle(element)
      return [style.display, style.paddingLeft, style.paddingRight, style.paddingBottom]
    })
  expect(await metrics()).toEqual(['flex', '7px', '11px', '13px'])

  await browserExpect
    .poll(() => connected, { message: 'The page connects to the Vite HMR channel' })
    .toBe(true)
  await browserExpect
    .poll(
      () =>
        Object.entries(server.watcher.getWatched()).some(
          ([directory, files]) =>
            resolve(directory) === dirname(stylesheet) && files.includes(basename(stylesheet)),
        ),
      { message: 'Vite watches the imported package stylesheet' },
    )
    .toBe(true)
  const documentStarted = await page.evaluate(() => performance.timeOrigin)
  record('Initial style applied and source watched')

  await Promise.all([
    rm(join(ui, 'dist/styles.css')),
    rm(join(appearance, 'dist/styles.css')),
    rm(join(appearance, 'dist/tailwind.css')),
  ])
  await writeFile(stylesheet, 'main { padding-right: 23px; }')
  record('Source edit written')
  await browserExpect(sample).toHaveCSS('padding-right', '23px')
  record('Edited style applied')
  expect(await metrics()).toEqual(['flex', '7px', '23px', '13px'])
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStarted)
  await page.reload()
  expect(await metrics()).toEqual(['flex', '7px', '23px', '13px'])
})
