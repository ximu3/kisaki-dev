import { test, expect } from 'vite-plus/test'
import { chromium } from 'playwright'
import { expect as browserExpect } from '@playwright/test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createServer, type AddressInfo } from 'node:net'
import Database from 'better-sqlite3'
import { launchApplication } from '../../../tools/dev/application'
import { startDevelopmentSession } from '../../../tools/dev/session'
import { appRoot } from '../../../tools/lib/paths'
import { hostTarget } from '../../../tools/lib/targets'
import { hasNativeWindow } from '../../support/window-observation'

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
    const db = new Database(join(profile, 'kisaki.sqlite'), { readonly: true })
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
