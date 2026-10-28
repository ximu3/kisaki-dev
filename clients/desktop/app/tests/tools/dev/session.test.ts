/**
 * @fileoverview Exercises real development-session shutdown, failed-build recovery,
 * generation handoff and renderer updates.
 */

import { afterAll, beforeAll, expect, test } from 'vitest'
import { chromium } from '@playwright/test'
import type { Browser } from '@playwright/test'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { closeNativeWindow, hasNativeWindow } from '../../support/window-observation'
import { prepareDevelopmentWorkspace } from '../../support/development-workspace'
import {
  developmentStartupTimeoutMs,
  startDevelopmentController,
} from '../../support/development-session'

let workspace: Awaited<ReturnType<typeof prepareDevelopmentWorkspace>>

beforeAll(async () => {
  workspace = await prepareDevelopmentWorkspace()
})

afterAll(async () => {
  await workspace?.close()
})

test('a refused quit retains utility processes and normal window close preserves the profile', async () => {
  const entry = join(workspace.app, 'src/main/entry.ts')
  const original = await readFile(entry, 'utf8')
  await writeFile(
    entry,
    `${original}
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
app.once('browser-window-created', (_event, window) => {
  const pids = app.getAppMetrics().filter((metric) => metric.type === 'Utility').map((metric) => metric.pid)
  window.once('close', (event) => {
    event.preventDefault()
    writeFileSync(join(app.getPath('userData'), 'cancelled-hosts.json'), JSON.stringify(pids))
  })
})
`,
  )
  const controller = startDevelopmentController(workspace.app)
  try {
    await expect
      .poll(() => controller.states.some((state) => state.state === 'ready'), {
        timeout: developmentStartupTimeoutMs,
      })
      .toBe(true)
    const first = controller.states.find((state) => state.state === 'ready')!
    expect(() => process.kill(first.current!.processId, 0)).not.toThrow()
    if (process.platform === 'win32') {
      // Native observation launches PowerShell; use the same budget as the artifact checks.
      await expect
        .poll(({ signal }) => hasNativeWindow(first.current!.processId, signal), {
          timeout: 30_000,
          interval: 250,
        })
        .toBe(true)
    }

    controller.process.send({ type: 'stop' })
    await expect
      .poll(() => controller.states.some((state) => state.state === 'cancelled'))
      .toBe(true)
    expect(controller.states.at(-1)?.current?.processId).toBe(first.current!.processId)
    const hostPids: number[] = JSON.parse(
      await readFile(join(workspace.app, '.local/development/cancelled-hosts.json'), 'utf8'),
    )
    expect(hostPids.length).toBeGreaterThan(0)
    for (const pid of hostPids) expect(() => process.kill(pid, 0)).not.toThrow()

    const marker = join(workspace.app, '.local/development/retained.txt')
    await writeFile(marker, 'synthetic retained development state')
    await closeNativeWindow(first.current!.processId)
    expect(await controller.closed, controller.diagnostics()).toBe(0)
    expect(await readFile(marker, 'utf8')).toBe('synthetic retained development state')
    expect(() => process.kill(first.current!.processId, 0)).toThrow()
  } finally {
    await controller.close()
    await writeFile(entry, original)
  }
})

test('a failed runtime build retains the old process and a renamed source hands off a complete generation', async () => {
  const entry = join(workspace.app, 'src/main/entry.ts')
  const original = await readFile(entry, 'utf8')
  const helper = join(workspace.app, 'src/main/app/development-fixture.ts')
  const renamed = join(workspace.app, 'src/main/app/renamed-fixture.ts')
  await writeFile(helper, "export const value = 'synthetic first generation'\n")
  await writeFile(
    entry,
    `${original}\nvoid import('./app/development-fixture').then((module) => console.info(module.value))\n`,
  )
  const controller = startDevelopmentController(workspace.app)
  try {
    await expect
      .poll(() => controller.states.some((state) => state.state === 'ready'), {
        timeout: developmentStartupTimeoutMs,
      })
      .toBe(true)
    const good = controller.states.find((state) => state.state === 'ready')!
    await writeFile(helper, 'export const value =\n')
    await expect
      .poll(() => controller.states.some((state) => state.state === 'failed'), { timeout: 60_000 })
      .toBe(true)
    expect(controller.states.at(-1)?.current?.processId).toBe(good.current!.processId)
    expect(() => process.kill(good.current!.processId, 0)).not.toThrow()

    await rename(helper, renamed)
    await writeFile(renamed, "export const value = 'synthetic repaired generation'\n")
    await writeFile(
      entry,
      `${original}\nvoid import('./app/renamed-fixture').then((module) => console.info(module.value))\n`,
    )
    await expect
      .poll(
        () =>
          controller.states.filter((state) => state.state === 'ready').at(-1)?.current?.processId,
        { timeout: 60_000 },
      )
      .not.toBe(good.current!.processId)
    await expect.poll(() => controller.diagnostics()).toContain('synthetic repaired generation')
  } finally {
    await controller.close()
    await writeFile(entry, original)
    await rm(helper, { force: true })
    await rm(renamed, { force: true })
  }
})

test('public-package recovery retains a usable session and renderer-only updates preserve its process', async () => {
  const styles = join(workspace.app, 'src/renderer/windows/main/styles.css')
  const configuration = join(
    workspace.root,
    'clients/desktop/packages/ui/config/typescript/tsconfig.lib.json',
  )
  const button = join(workspace.root, 'clients/desktop/packages/ui/src/components/button.tsx')
  const originals = await Promise.all(
    [styles, configuration, button].map((path) => readFile(path, 'utf8')),
  )
  const controller = startDevelopmentController(workspace.app)
  let browser: Browser | undefined
  try {
    browser = await chromium.launch({ headless: true })
    await expect
      .poll(() => controller.states.some((state) => state.state === 'ready'), {
        timeout: developmentStartupTimeoutMs,
      })
      .toBe(true)
    const first = controller.states.find((state) => state.state === 'ready')!
    const page = await browser.newPage()
    // Chromium observes HMR; the concurrent Electron process supplies the actual desktop lifecycle.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'kisaki', {
        value: { kind: 'main', close: async () => undefined },
      })
    })
    await page.goto(new URL('main/index.html', first.rendererUrl!).href)
    await page.getByRole('button', { name: 'Close window' }).waitFor()
    await writeFile(styles, `${originals[0]}\n.window-shell { padding: 73px; }\n`)
    await expect
      .poll(() => page.locator('main').evaluate((element) => getComputedStyle(element).paddingLeft))
      .toBe('73px')

    await writeFile(configuration, '{')
    await expect
      .poll(() => controller.states.some((state) => state.state === 'failed'), { timeout: 60_000 })
      .toBe(true)
    expect(controller.states.at(-1)?.current?.processId).toBe(first.current!.processId)
    expect(() => process.kill(first.current!.processId, 0)).not.toThrow()
    const readyBeforeRepair = controller.states.filter((state) => state.state === 'ready').length
    await writeFile(configuration, originals[1]!)
    await expect
      .poll(() => controller.states.filter((state) => state.state === 'ready').length, {
        timeout: 60_000,
      })
      .toBeGreaterThan(readyBeforeRepair)
    const recovered = controller.states.filter((state) => state.state === 'ready').at(-1)!

    const readyBeforeUpdate = controller.states.filter((state) => state.state === 'ready').length
    await writeFile(button, originals[2]!.replace('<button', '<button data-fixture="updated"'))
    await expect
      .poll(() => controller.states.filter((state) => state.state === 'ready').length, {
        timeout: 60_000,
      })
      .toBeGreaterThan(readyBeforeUpdate)
    expect(
      controller.states.filter((state) => state.state === 'ready').at(-1)?.current?.processId,
    ).toBe(recovered.current!.processId)
    await expect
      .poll(() => page.getByRole('button').getAttribute('data-fixture'), { timeout: 15_000 })
      .toBe('updated')
    expect(await page.locator('main').count()).toBe(1)
  } finally {
    await controller.close()
    await browser?.close()
    await Promise.all(
      [styles, configuration, button].map((path, index) => writeFile(path, originals[index]!)),
    )
  }
})
