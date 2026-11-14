/**
 * @fileoverview Exercises real development-session shutdown, failed-build recovery,
 * generation handoff and renderer updates.
 */

import { expect, onTestFinished, test } from 'vite-plus/test'
import { chromium } from '@playwright/test'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appRoot } from '../../../tools/lib/paths'
import { closeNativeWindow, hasNativeWindow } from '../../support/window-observation'
import { prepareDevelopmentWorkspace } from './workspace'
import { startDevelopmentController } from './controller'

test('a refused quit retains utility processes and normal window close preserves the profile', async () => {
  const controller = await startDevelopmentController(appRoot, { scenario: 'cancel-first-close' })
  await controller.ready
  const first = controller.states.find((state) => state.state === 'ready')!
  expect(() => process.kill(first.current!.processId, 0)).not.toThrow()
  if (process.platform === 'win32') {
    // Windows observation starts PowerShell and uses the artifact checks' startup budget.
    await expect
      .poll(({ signal }) => hasNativeWindow(first.current!.processId, signal), {
        timeout: 30_000,
        interval: 250,
      })
      .toBe(true)
  }

  controller.process.send({ type: 'stop' })
  await expect
    .poll(() => controller.states.some((state) => state.state === 'cancelled'), { timeout: 15_000 })
    .toBe(true)
  expect(controller.states.at(-1)?.current?.processId).toBe(first.current!.processId)

  const hostPids = JSON.parse(
    await readFile(join(controller.profile, 'cancelled-hosts.json'), 'utf8'),
  ) as number[]
  expect(hostPids.length).toBeGreaterThan(0)
  for (const pid of hostPids) {
    expect(() => process.kill(pid, 0)).not.toThrow()
  }

  const marker = join(controller.profile, 'retained.txt')
  await writeFile(marker, 'synthetic retained development state')

  await closeNativeWindow(first.current!.processId)

  expect(await controller.closed).toBe(0)
  expect(await readFile(marker, 'utf8')).toBe('synthetic retained development state')
  expect(() => process.kill(first.current!.processId, 0)).toThrow()
})

test('runtime syntax, renamed imports and configuration errors recover through native compilation', async () => {
  const workspace = await prepareDevelopmentWorkspace()
  onTestFinished(workspace.close)
  const entry = join(workspace.app, 'tests/fixtures/desktop-app/src/main/entry.ts')
  const original = await readFile(entry, 'utf8')
  const helper = join(workspace.app, 'tests/fixtures/desktop-app/src/main/development-fixture.ts')
  const renamed = join(workspace.app, 'tests/fixtures/desktop-app/src/main/renamed-fixture.ts')
  const configuration = join(
    workspace.app,
    'tests/fixtures/desktop-app/config/vite/vite.config.main.ts',
  )
  const originalConfiguration = await readFile(configuration, 'utf8')
  onTestFinished(() => writeFile(entry, original))
  onTestFinished(() => writeFile(configuration, originalConfiguration))
  onTestFinished(() => rm(helper, { force: true }))
  onTestFinished(() => rm(renamed, { force: true }))

  await writeFile(helper, "export const value = 'synthetic first generation'\n")
  await writeFile(
    entry,
    `${original}\nvoid import('./development-fixture').then((module) => console.info(module.value))\n`,
  )

  const controller = await startDevelopmentController(workspace.app)
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
  await expect.poll(() => controller.output).toContain('synthetic repaired generation')

  const repaired = controller.states.filter((state) => state.state === 'ready').at(-1)!
  const failures = controller.states.filter((state) => state.state === 'failed').length
  await writeFile(configuration, 'export default {\n')
  await expect
    .poll(() => controller.states.filter((state) => state.state === 'failed').length, {
      timeout: 60_000,
    })
    .toBeGreaterThan(failures)
  expect(() => process.kill(repaired.current!.processId, 0)).not.toThrow()

  await writeFile(configuration, originalConfiguration)
  await expect
    .poll(
      () => controller.states.filter((state) => state.state === 'ready').at(-1)?.current?.processId,
      { timeout: 60_000 },
    )
    .not.toBe(repaired.current!.processId)
})

test('dependency recovery and renderer updates preserve a usable process', async () => {
  const workspace = await prepareDevelopmentWorkspace()
  onTestFinished(workspace.close)
  const styles = join(
    workspace.app,
    'tests/fixtures/desktop-app/src/renderer/windows/main/styles.css',
  )
  const renderer = join(
    workspace.app,
    'tests/fixtures/desktop-app/src/renderer/windows/main/entry.tsx',
  )
  const dependency = join(workspace.contracts, 'src/development.ts')
  const paths = [styles, renderer, dependency]
  const originals = await Promise.all(paths.map((path) => readFile(path, 'utf8')))
  for (const [index, path] of paths.entries()) {
    onTestFinished(() => writeFile(path, originals[index]!))
  }
  await writeFile(
    renderer,
    originals[1]!
      .replace(
        "import './styles.css'",
        "import { developmentProtocolId } from '@kisaki3/desktop-contracts/development'\nimport './styles.css'",
      )
      .replace('<main>', '<main data-protocol={developmentProtocolId}>'),
  )
  const controller = await startDevelopmentController(workspace.app)

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

  // Observe the rejected module in this page's HMR request before restoring the source.
  const rejected = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith('/src/development.ts') && response.status() === 500,
    { timeout: 15_000 },
  )
  await Promise.all([rejected, writeFile(dependency, 'export const broken =\n')])
  expect(() => process.kill(first.current!.processId, 0)).not.toThrow()

  await writeFile(dependency, originals[2]!.replace("'kisaki.development'", "'fixture.updated'"))
  await expect
    .poll(() => page.locator('main').getAttribute('data-protocol'), { timeout: 15_000 })
    .toBe('fixture.updated')
  expect(
    controller.states.filter((state) => state.state === 'ready').at(-1)?.current?.processId,
  ).toBe(first.current!.processId)
})

test('a failed application stop is reported and the worker releases its owned process', async () => {
  const controller = await startDevelopmentController(appRoot, {
    scenario: 'stop-failure',
    expectedExitCode: 1,
  })
  await controller.ready
  const application = controller.states.find((state) => state.state === 'ready')!.current!

  controller.process.send({ type: 'stop' })
  await expect.poll(() => controller.process.exitCode, { timeout: 15_000 }).toBe(1)
  expect(await controller.closed).toBe(1)
  expect(controller.output).toContain('Synthetic application stop failure')
  expect(() => process.kill(application.processId, 0)).toThrow()
})
