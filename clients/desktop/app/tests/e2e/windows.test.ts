/**
 * @fileoverview Verifies isolation, minimal preload controls and normal closure for each
 * desktop window kind.
 */

import { test, expect } from '../support/electron'

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
      // Renderer shutdown can close the click transport before its acknowledgement arrives.
      try {
        await page.getByRole('button', { name: 'Close window' }).click()
      } catch (cause) {
        if (!page.isClosed()) {
          throw cause
        }
      }

      await closed
      expect(child.exitCode).toBe(0)
    })
  })
}
