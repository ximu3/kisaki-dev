import { test, expect, onTestFinished } from 'vite-plus/test'
import { chromium } from 'playwright'
import { expect as browserExpect } from '@playwright/test'
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createServer, type AddressInfo } from 'node:net'
import Database from 'better-sqlite3'
import { launchApplication } from '../../tools/dev/application'
import { createRenderer } from '../../tools/dev/renderer/server'
import { startDevelopmentSession } from '../../tools/dev/session'
import { appRoot } from '../../tools/lib/paths'
import { hostTarget } from '../../tools/lib/targets'
import { windowKinds } from '../../src/shared/window-api/protocol'
import { hasNativeWindow } from '../support/window-observation'

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

  const server = await createRenderer(root, 'stylesheet-test', join(root, 'vite-cache'))
  onTestFinished(() => server.close())
  await server.listen()
  const browser = await chromium.launch()
  onTestFinished(() => browser.close())
  const page = await browser.newPage()
  await page.goto(new URL('main/index.html', server.resolvedUrls!.local[0]).href)
  const sample = page.locator('main')
  const metrics = () =>
    sample.evaluate((element) => {
      const style = getComputedStyle(element)
      return [style.display, style.paddingLeft, style.paddingRight, style.paddingBottom]
    })
  expect(await metrics()).toEqual(['flex', '7px', '11px', '13px'])

  await Promise.all([
    rm(join(ui, 'dist/styles.css')),
    rm(join(appearance, 'dist/styles.css')),
    rm(join(appearance, 'dist/tailwind.css')),
  ])
  await writeFile(join(appearance, 'src/styles.css'), 'main { padding-right: 23px; }')
  await expect.poll(metrics).toEqual(['flex', '7px', '23px', '13px'])
  await page.reload()
  expect(await metrics()).toEqual(['flex', '7px', '23px', '13px'])
})

async function inspectorPort(): Promise<number> {
  const socket = createServer().listen(0, '127.0.0.1')
  await once(socket, 'listening')
  const { port } = socket.address() as AddressInfo
  const closed = once(socket, 'close')
  socket.close()
  await closed
  return port
}

async function verifyWindowStyles(port: number, rendererUrl: string): Promise<void> {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + port)
  try {
    const page = browser
      .contexts()[0]!
      .pages()
      .find((item) => item.url().startsWith(rendererUrl))!
    await browserExpect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans')
    const applicationMenu = page.getByRole('button', { name: '应用菜单', exact: true })
    await applicationMenu.click()
    const settings = page.getByRole('menuitem', { name: '偏好设置', exact: true })
    expect(
      await settings.evaluate((node) => parseFloat(getComputedStyle(node).paddingInlineStart)),
    ).toBeGreaterThan(0)
    await settings.click()

    const dialog = page.getByRole('dialog', { name: '偏好设置', exact: true })
    await browserExpect(dialog).toBeVisible()
    const frame = await dialog.evaluate((node) => {
      const bounds = node.getBoundingClientRect()
      const tabs = node.querySelector('[role="tablist"]')!.getBoundingClientRect()
      return {
        offset: Math.abs(bounds.left - (innerWidth - bounds.right)),
        inset: tabs.left - bounds.left,
        rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
      }
    })
    expect(frame.offset).toBeLessThan(1)
    expect(frame.inset).toBeLessThan(frame.rem + 3)

    const tab = dialog.getByRole('tab', { name: '常规', exact: true })
    expect(
      await tab.evaluate((node) => parseFloat(getComputedStyle(node).paddingInlineStart)),
    ).toBeGreaterThan(0)
  } finally {
    await browser.close()
  }
}

test('the source session styles its native window, opens its migrated library and stops normally', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'kisaki-source-'))
  const target = hostTarget()
  const failed = Promise.withResolvers<never>()
  void failed.promise.catch(() => {})
  const started = performance.now()
  let port!: number
  const session = await startDevelopmentSession({
    sourceRoot: appRoot,
    profile,
    startupTimeoutMs: 90_000,
    async launch(options) {
      port = await inspectorPort()
      return launchApplication({
        ...options,
        args: [...options.args, '--remote-debugging-port=' + port],
      })
    },
    onState(state, error) {
      if (state === 'failed') {
        failed.reject(error)
      }
    },
    prepared: {
      resources: join(appRoot, 'out/resources', target),
      nativeBinding: join(appRoot, 'out/native', target, 'kisaki-native.node'),
    },
  })
  try {
    await Promise.race([session.ready, failed.promise])
    console.info(
      'Source compiler and application ready in ms:',
      Math.round(performance.now() - started),
    )
    expect(await hasNativeWindow(session.current!.processId)).toBe(true)
    await verifyWindowStyles(port, session.rendererUrl)
    await expect(session.stop()).resolves.toBe('stopped')
    const db = new Database(join(profile, 'library.sqlite'), { readonly: true })
    try {
      expect(db.prepare('select count(*) from __drizzle_migrations').pluck().get()).toBeGreaterThan(
        0,
      )
    } finally {
      db.close()
    }
  } catch (error) {
    const milestones = await readFile(join(profile, 'logs', 'runtime.log'), 'utf8').catch(
      () => null,
    )
    console.error('Source startup milestones:', milestones ?? 'The runtime log did not open')
    throw error
  } finally {
    await session.terminate()
    await rm(profile, { recursive: true, force: true, maxRetries: 4 })
  }
})
