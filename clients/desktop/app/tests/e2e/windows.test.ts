/** @fileoverview Verifies the four compiled renderer/preload entries and Electron isolation. */

import { test, expect } from '../support/electron'

for (const kind of ['main', 'reader', 'player', 'game-panel'] as const) {
  test.describe(kind, () => {
    test.use({ kind })
    test('loads its sandboxed preload and renderer with a live utility process', async ({
      desktop,
    }) => {
      const page = await desktop.firstWindow()
      await expect(page.getByRole('heading')).toHaveText('Engineering fixture')
      await page.getByRole('button').click()
      await expect(page.getByRole('button')).toHaveText('Count: 1')
      const identity = await page.evaluate(async () => {
        const carrier = window as typeof window & {
          fixture: { identity(): Promise<{ kind: string; buildId: string; workerPid: number }> }
        }
        return carrier.fixture.identity()
      })
      expect(identity.kind).toBe(kind)
      expect(identity.buildId).toMatch(/\S/)
      expect(identity.workerPid).toBeGreaterThan(0)
      expect(await page.evaluate(() => typeof (globalThis as { process?: unknown }).process)).toBe(
        'undefined',
      )
      expect(
        await page.evaluate(() => {
          const carrier = window as typeof window & {
            fixture: { sandboxed: boolean; isolated: boolean }
          }
          return { sandboxed: carrier.fixture.sandboxed, isolated: carrier.fixture.isolated }
        }),
      ).toEqual({ sandboxed: true, isolated: true })
    })
  })
}
