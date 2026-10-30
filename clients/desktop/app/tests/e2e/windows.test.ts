/**
 * @fileoverview Verifies window isolation, sender-bound controls and independent window
 * lifetimes in the desktop process.
 */

import { test, expect } from '../support/electron'
import type { Page } from '@playwright/test'
import type { BrowserWindow } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import ts from 'typescript'
import type * as NativeWindow from '../../src/main/infrastructure/windows/native-window'
import { buildDirectory } from '../../tools/lib/paths'
import { hostTarget } from '../../tools/lib/targets'

/** Close through the window's UI and wait for closure, including a click whose reply ends with its page. */
async function closeWindow(page: Page): Promise<void> {
  const closed = page.waitForEvent('close')
  try {
    await page.getByRole('button', { name: 'Close window' }).click()
  } catch (cause) {
    if (!page.isClosed()) {
      throw cause
    }
  }

  await closed
}

for (const kind of ['main', 'reader', 'player', 'game-panel'] as const) {
  test.describe(kind, () => {
    test.use({ kind })

    test('renders in its own sandbox with a minimal bridge and closes normally', async ({
      desktop,
      profile,
      kind,
    }) => {
      const child = desktop.process()
      const page = await desktop.firstWindow()
      await expect(page.getByRole('button', { name: 'Close window' })).toBeVisible()

      const values = await page.evaluate(() => ({
        bridge: Object.keys(window.kisaki).sort(),
        kind: window.kisaki.kind,
        node: typeof Reflect.get(globalThis, 'require'),
        process: typeof Reflect.get(globalThis, 'process'),
      }))
      expect(values).toEqual({
        bridge: ['close', 'kind'],
        kind,
        node: 'undefined',
        process: 'undefined',
      })

      const runtime = await desktop.evaluate(({ app, BrowserWindow }) => ({
        userData: app.getPath('userData'),
        sessionData: app.getPath('sessionData'),
        sandboxed: app
          .getAppMetrics()
          .find(
            (metric) =>
              metric.pid === BrowserWindow.getAllWindows()[0]!.webContents.getOSProcessId(),
          )?.sandboxed,
        metrics: app.getAppMetrics().map((metric) => metric.type),
      }))
      expect(runtime.userData).toBe(profile)
      expect(runtime.sessionData.startsWith(profile)).toBe(true)
      if (process.platform !== 'linux') {
        expect(runtime.sandboxed).toBe(true)
      }
      expect(runtime.metrics).toContain('Utility')

      const closed = desktop.waitForEvent('close')
      await closeWindow(page)

      await closed
      expect(child.exitCode).toBe(0)
    })
  })
}

test('closing the launch window leaves another window usable and releases its activation handler', async ({
  desktop,
  profile,
}) => {
  const child = desktop.process()
  const main = await desktop.firstWindow()
  await expect(main.getByRole('button', { name: 'Close window' })).toBeVisible()

  // The factory is a test-owned module; windows consume the prepared desktop renderer and preload.
  const source = await readFile(
    new URL('../../src/main/infrastructure/windows/native-window.ts', import.meta.url),
    'utf8',
  )
  const modulePath = join(profile, 'native-window.cjs')
  await writeFile(
    modulePath,
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
    }).outputText,
  )

  const [reader] = await Promise.all([
    desktop.waitForEvent('window'),
    desktop.evaluate(
      async (_electron, { modulePath, runtime }) => {
        // The debugger's evaluated scope cannot perform dynamic imports.
        const require = process.getBuiltinModule('module').createRequire(modulePath)
        const { createNativeWindow } = require(modulePath) as typeof NativeWindow
        await createNativeWindow({
          runtime,
          title: 'Reader',
          kind: 'reader',
          rendererUrl: undefined,
        })
      },
      { modulePath, runtime: buildDirectory(hostTarget()) },
    ),
  ])
  await expect(reader.getByRole('button', { name: 'Close window' })).toBeVisible()

  const mainWindow = await desktop.browserWindow(main)
  await mainWindow.evaluate(
    (window: BrowserWindow) =>
      new Promise<void>((resolve) => {
        window.once('closed', () => resolve())
        window.close()
      }),
  )
  await mainWindow.dispose()

  await desktop.evaluate(({ app }) => {
    app.emit('second-instance')
  })
  await expect(reader.getByRole('button', { name: 'Close window' })).toBeVisible()

  const closed = desktop.waitForEvent('close')
  await closeWindow(reader)
  await closed

  expect(child.exitCode).toBe(0)
})
