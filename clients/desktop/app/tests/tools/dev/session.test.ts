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
} from '../../support/development-controller'

let workspace: Awaited<ReturnType<typeof prepareDevelopmentWorkspace>>

beforeAll(async () => {
  workspace = await prepareDevelopmentWorkspace()
})

afterAll(async () => {
  await workspace?.close()
})

test('a refused quit retains utility processes and normal window close preserves the profile', async () => {
  const entry = join(workspace.app, 'tests/fixtures/runtime/src/main/entry.ts')
  const original = await readFile(entry, 'utf8')
  await writeFile(
    entry,
    "import { writeFileSync } from 'node:fs'\n" +
      original.replace(
        'const rendererUrl =',
        `
  window.once('close', (event) => {
    event.preventDefault()
    const pids = app.getAppMetrics().filter((metric) => metric.type === 'Utility').map((metric) => metric.pid)
    writeFileSync(join(app.getPath('userData'), 'cancelled-hosts.json'), JSON.stringify(pids))
  })
  const rendererUrl =`,
      ),
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

    const hostPids = JSON.parse(
      await readFile(join(workspace.app, '.local/development/cancelled-hosts.json'), 'utf8'),
    ) as number[]
    expect(hostPids.length).toBeGreaterThan(0)
    for (const pid of hostPids) {
      expect(() => process.kill(pid, 0)).not.toThrow()
    }

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
  const entry = join(workspace.app, 'tests/fixtures/runtime/src/main/entry.ts')
  const original = await readFile(entry, 'utf8')
  const helper = join(workspace.app, 'tests/fixtures/runtime/src/main/development-fixture.ts')
  const renamed = join(workspace.app, 'tests/fixtures/runtime/src/main/renamed-fixture.ts')
  await writeFile(helper, "export const value = 'synthetic first generation'\n")
  await writeFile(
    entry,
    `${original}\nvoid import('./development-fixture').then((module) => console.info(module.value))\n`,
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
      `${original}\nvoid import('./renamed-fixture').then((module) => console.info(module.value))\n`,
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

test('dependency recovery and renderer updates preserve a usable process', async () => {
  const styles = join(workspace.app, 'tests/fixtures/runtime/src/renderer/windows/main/styles.css')
  const renderer = join(workspace.app, 'tests/fixtures/runtime/src/renderer/windows/main/entry.tsx')
  const dependency = join(workspace.root, 'packages/development-fixture/src/value.json')
  const originals = await Promise.all(
    [styles, renderer, dependency].map((path) => readFile(path, 'utf8')),
  )
  await writeFile(
    renderer,
    originals[1]!
      .replace(
        "import './styles.css'",
        "import './styles.css'\nimport { label } from '@kisaki3/development-fixture'",
      )
      .replace('<main>', '<main data-dependency={label}>'),
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
    await page.goto(new URL('main/index.html', first.rendererUrl!).href)
    await page.getByRole('button', { name: 'Count: 0' }).waitFor()
    await page.getByRole('button').click()
    await writeFile(styles, `${originals[0]}\n#root { padding: 73px; }\n`)
    await expect
      .poll(() =>
        page.locator('#root').evaluate((element) => getComputedStyle(element).paddingLeft),
      )
      .toBe('73px')
    expect(await page.getByRole('button', { name: 'Count: 1' }).count()).toBe(1)
    await writeFile(dependency, '{')
    await expect
      .poll(() => controller.states.some((state) => state.state === 'failed'), { timeout: 60_000 })
      .toBe(true)
    expect(controller.states.at(-1)?.current?.processId).toBe(first.current!.processId)
    const readyBefore = controller.states.filter((state) => state.state === 'ready').length
    await writeFile(dependency, originals[2]!)
    await expect
      .poll(() => controller.states.filter((state) => state.state === 'ready').length, {
        timeout: 60_000,
      })
      .toBeGreaterThan(readyBefore)
    const recovered = controller.states.filter((state) => state.state === 'ready').at(-1)!
    // Recovery may rebuild the runtime; a subsequent dependency-only update must not restart it.
    const readyBeforeUpdate = controller.states.filter((state) => state.state === 'ready').length
    await writeFile(dependency, JSON.stringify({ label: 'updated' }))
    await expect
      .poll(() => controller.states.filter((state) => state.state === 'ready').length, {
        timeout: 60_000,
      })
      .toBeGreaterThan(readyBeforeUpdate)
    expect(
      controller.states.filter((state) => state.state === 'ready').at(-1)?.current?.processId,
    ).toBe(recovered.current!.processId)
    await expect
      .poll(() => page.locator('main').getAttribute('data-dependency'), { timeout: 15_000 })
      .toBe('updated')
  } finally {
    await controller.close()
    await browser?.close()
    await Promise.all(
      [styles, renderer, dependency].map((path, index) => writeFile(path, originals[index]!)),
    )
  }
})
