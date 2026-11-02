/**
 * @fileoverview Exercises real development-session shutdown, failed-build recovery,
 * generation handoff and renderer updates.
 */

import { afterAll, beforeAll, expect, onTestFinished, test } from 'vitest'
import { chromium } from '@playwright/test'
import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { hostTarget } from '../../../tools/lib/targets'
import { closeNativeWindow, hasNativeWindow } from '../../support/window-observation'
import { prepareDevelopmentWorkspace } from '../../support/development-workspace'
import { startDevelopmentController } from '../../support/development-controller'

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
  onTestFinished(() => writeFile(entry, original))
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
  await controller.ready
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
  await expect.poll(() => controller.states.some((state) => state.state === 'cancelled')).toBe(true)
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
})

test('a failed runtime build retains the old process and a renamed source hands off a complete generation', async () => {
  const entry = join(workspace.app, 'tests/fixtures/runtime/src/main/entry.ts')
  const original = await readFile(entry, 'utf8')
  const helper = join(workspace.app, 'tests/fixtures/runtime/src/main/development-fixture.ts')
  const renamed = join(workspace.app, 'tests/fixtures/runtime/src/main/renamed-fixture.ts')
  onTestFinished(() => writeFile(entry, original))
  onTestFinished(() => rm(helper, { force: true }))
  onTestFinished(() => rm(renamed, { force: true }))
  await writeFile(helper, "export const value = 'synthetic first generation'\n")
  await writeFile(
    entry,
    `${original}\nvoid import('./development-fixture').then((module) => console.info(module.value))\n`,
  )

  const controller = startDevelopmentController(workspace.app)
  await controller.ready
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
      () => controller.states.filter((state) => state.state === 'ready').at(-1)?.current?.processId,
      { timeout: 60_000 },
    )
    .not.toBe(good.current!.processId)
  await expect.poll(() => controller.diagnostics()).toContain('synthetic repaired generation')
})

test('dependency recovery and renderer updates preserve a usable process', async () => {
  const styles = join(workspace.app, 'tests/fixtures/runtime/src/renderer/windows/main/styles.css')
  const renderer = join(workspace.app, 'tests/fixtures/runtime/src/renderer/windows/main/entry.tsx')
  const dependency = join(workspace.root, 'packages/development-fixture/src/value.json')
  const originals = await Promise.all(
    [styles, renderer, dependency].map((path) => readFile(path, 'utf8')),
  )
  for (const [index, path] of [styles, renderer, dependency].entries()) {
    onTestFinished(() => writeFile(path, originals[index]!))
  }
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
  const browser = await chromium.launch({ headless: true })
  onTestFinished(() => browser.close())
  await controller.ready
  const first = controller.states.find((state) => state.state === 'ready')!
  const page = await browser.newPage()
  await page.goto(new URL('main/index.html', first.rendererUrl!).href)
  await page.getByRole('button', { name: 'Count: 0' }).waitFor()
  await page.getByRole('button').click()
  await writeFile(styles, `${originals[0]}\n#root { padding: 73px; }\n`)
  await expect
    .poll(() => page.locator('#root').evaluate((element) => getComputedStyle(element).paddingLeft))
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
})

test.each(['cancellation', 'command failure'] as const)(
  '%s during initial preparation closes its command and permits a complete retry',
  async (outcome) => {
    const manifestPath = join(workspace.root, 'packages/development-fixture/package.json')
    const preparationPath = join(workspace.root, '.cache', 'dependency-preparation.json')
    const processPath = join(workspace.root, 'packages/tooling/src/process.ts')
    const original = await readFile(manifestPath, 'utf8')
    const originalProcess = await readFile(processPath, 'utf8')
    onTestFinished(() => writeFile(manifestPath, original))
    onTestFinished(() => writeFile(processPath, originalProcess))
    onTestFinished(() => rm(preparationPath, { force: true }))

    const manifest = JSON.parse(original) as { scripts: Record<string, string> }
    manifest.scripts.build =
      'node --import tsx ../../clients/desktop/app/tests/support/preparation-worker.ts'
    await writeFile(manifestPath, JSON.stringify(manifest))
    if (outcome === 'command failure') {
      await writeFile(
        processPath,
        originalProcess.replace(
          'await run(invocation.command, invocation.args, options)',
          `await run(invocation.command, invocation.args, options).catch((cause: unknown) => {
    if (options.signal?.aborted) {
      throw new Error('Synthetic command cancellation failure', { cause })
    }
    throw cause
  })`,
        ),
      )
    }

    const first = startDevelopmentController(workspace.app)
    const sessions = join(workspace.app, 'out', 'development', hostTarget())
    let preparation: { pid: number } | undefined
    await expect
      .poll(
        async () => {
          try {
            preparation = JSON.parse(await readFile(preparationPath, 'utf8')) as typeof preparation
            return true
          } catch (cause) {
            if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') {
              throw cause
            }

            return false
          }
        },
        { timeout: 60_000 },
      )
      .toBe(true)

    first.process.send({ type: 'stop' })
    expect(await first.closed, first.diagnostics()).toBe(outcome === 'cancellation' ? 0 : 1)
    if (outcome === 'command failure') {
      expect(first.diagnostics()).toContain('Synthetic command cancellation failure')
    }
    expect(first.states.some((state) => state.state === 'ready')).toBe(false)
    expect(await readdir(sessions)).toEqual([])
    expect(preparation).toBeDefined()

    await expect
      .poll(() => {
        try {
          process.kill(preparation!.pid, 0)
          return true
        } catch (cause) {
          if ((cause as NodeJS.ErrnoException).code !== 'ESRCH') {
            throw cause
          }

          return false
        }
      })
      .toBe(false)

    await writeFile(manifestPath, original)
    await writeFile(processPath, originalProcess)
    const retry = startDevelopmentController(workspace.app)
    await retry.ready

    retry.process.send({ type: 'stop' })
    expect(await retry.closed, retry.diagnostics()).toBe(0)
    expect(await readdir(sessions)).toEqual([])
  },
)

test('a failed application stop is reported and the worker releases its owned process', async () => {
  const launcher = join(workspace.app, 'tests/support/fixture-application.ts')
  const original = await readFile(launcher, 'utf8')
  onTestFinished(() => writeFile(launcher, original))
  // Reject one real session stop at its supplied application boundary, then allow cleanup.
  await writeFile(
    launcher,
    original
      .replace('  let stopping: Promise', '  let rejectStop = true\n  let stopping: Promise')
      .replace(
        '    stop() {',
        `    stop() {
      if (rejectStop) {
        rejectStop = false
        return Promise.reject(new Error('Synthetic application stop failure'))
      }`,
      ),
  )

  const controller = startDevelopmentController(workspace.app)
  await controller.ready
  const application = controller.states.find((state) => state.state === 'ready')!.current!

  controller.process.send({ type: 'stop' })
  await expect.poll(() => controller.process.exitCode, { timeout: 15_000 }).toBe(1)
  expect(await controller.closed, controller.diagnostics()).toBe(1)
  expect(controller.diagnostics()).toContain('Synthetic application stop failure')
  expect(() => process.kill(application.processId, 0)).toThrow()
})

test('a startup failure rejects readiness with the worker diagnostics', async () => {
  const config = join(workspace.app, 'tests/fixtures/runtime/config/vite/vite.config.renderer.ts')
  const original = await readFile(config, 'utf8')
  onTestFinished(() => writeFile(config, original))
  await writeFile(config, "throw new Error('Synthetic renderer startup failure')\n")
  const controller = startDevelopmentController(workspace.app)

  await expect(controller.ready).rejects.toThrow('Synthetic renderer startup failure')
  expect(await controller.closed, controller.diagnostics()).toBe(1)
})
