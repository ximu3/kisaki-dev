import { expect, test } from 'vitest'
import { chromium } from '@playwright/test'
import type { Browser } from '@playwright/test'
import { spawn } from 'node:child_process'
import { readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { hasNativeWindow } from '../../support/window-observation'
import { prepareDevelopmentWorkspace } from '../../support/development-workspace'
import type { DevelopmentBuild } from '../../../tools/dev/session'
import { readPnpm } from '../../../../../../tools/outputs'

/** Test-only observations from the fixture controller, not an application protocol. */
interface Observation {
  state: 'building' | 'failed' | 'ready' | 'stopped'
  current?: DevelopmentBuild
  rendererUrl?: string
}

test('hands off complete generations, retains the last good build and stops without resetting the profile', async () => {
  const workspace = await prepareDevelopmentWorkspace()
  const states: Observation[] = []
  let diagnostics = ''
  const controller = spawn(
    process.execPath,
    ['--import', 'tsx', 'tests/support/development-controller.ts'],
    {
      cwd: workspace.app,
      windowsHide: true,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    },
  )
  controller.on('message', (message: Observation) => states.push(message))
  controller.stdout!.setEncoding('utf8').on('data', (chunk: string) => {
    diagnostics = (diagnostics + chunk).slice(-16_384)
  })
  controller.stderr!.setEncoding('utf8').on('data', (chunk: string) => {
    diagnostics = (diagnostics + chunk).slice(-16_384)
  })
  const closed = new Promise<number | null>((resolve, reject) => {
    controller.once('error', reject)
    controller.once('close', resolve)
  })
  let browser: Browser | undefined
  try {
    browser = await chromium.launch({ headless: true })
    await expect
      .poll(() => states.filter((state) => state.state === 'ready').length, {
        timeout: 120_000,
        interval: 100,
      })
      .toBeGreaterThan(0)
    const first = states.filter((state) => state.state === 'ready').at(-1)!
    await expect(
      readPnpm(['--filter', '@kisaki3/desktop', 'run', 'clean'], workspace.root),
    ).rejects.toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining('Output is in use'),
    })
    await readPnpm(['--filter', '@kisaki3/rpc', 'build'], workspace.root)
    expect(() => process.kill(first.current!.processId, 0)).not.toThrow()
    if (process.platform === 'win32') {
      await expect.poll(() => hasNativeWindow(first.current!.processId)).toBe(true)
    }

    const page = await browser.newPage()
    // This page checks Vite HMR; the concurrently running Electron supplies the real preload and host.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'kisaki', {
        value: { kind: 'main', close: async () => undefined },
      })
    })
    await page.goto(new URL('main/index.html', first.rendererUrl!).href)
    await page.getByRole('button', { name: 'Close window' }).waitFor()
    const styles = join(workspace.app, 'src/renderer/windows/main/styles.css')
    await writeFile(styles, `${await readFile(styles, 'utf8')}\n.window-shell { padding: 73px; }\n`)
    await expect
      .poll(() => page.locator('main').evaluate((element) => getComputedStyle(element).paddingLeft))
      .toBe('73px')

    const configuration = join(workspace.app, 'config/vite/vite.config.main.ts')
    await writeFile(
      configuration,
      (await readFile(configuration, 'utf8')).replace(
        'rolldownOptions: {',
        "rolldownOptions: { output: { banner: '/* Synthetic configuration update. */' },",
      ),
    )
    await expect
      .poll(() => states.filter((state) => state.state === 'ready').at(-1)?.current?.processId, {
        timeout: 60_000,
      })
      .not.toBe(first.current!.processId)
    const configured = states.filter((state) => state.state === 'ready').at(-1)!
    expect(await readFile(join(configured.current!.directory, 'main/entry.js'), 'utf8')).toContain(
      '/* Synthetic configuration update. */',
    )

    const applicationManifest = join(workspace.app, 'package.json')
    const originalManifest = await readFile(applicationManifest, 'utf8')
    const manifest: { imports: Record<string, string> } = JSON.parse(originalManifest)
    const importFailures = states.filter((state) => state.state === 'failed').length
    await writeFile(
      applicationManifest,
      JSON.stringify({
        ...manifest,
        imports: { ...manifest.imports, '#native': './native/node/absent-fixture.ts' },
      }),
    )
    await expect
      .poll(() => states.filter((state) => state.state === 'failed').length, { timeout: 60_000 })
      .toBeGreaterThan(importFailures)
    expect(states.at(-1)?.current?.processId).toBe(configured.current!.processId)
    expect(() => process.kill(configured.current!.processId, 0)).not.toThrow()

    await writeFile(applicationManifest, originalManifest)
    await expect
      .poll(() => states.filter((state) => state.state === 'ready').at(-1)?.current?.processId, {
        timeout: 60_000,
      })
      .not.toBe(configured.current!.processId)
    const importsRecovered = states.filter((state) => state.state === 'ready').at(-1)!

    const libraryConfiguration = join(
      workspace.root,
      'clients/desktop/packages/ui/config/typescript/tsconfig.lib.json',
    )
    const libraryOptions = await readFile(libraryConfiguration, 'utf8')
    const configurationFailures = states.filter((state) => state.state === 'failed').length
    await writeFile(libraryConfiguration, '{')
    await expect
      .poll(() => states.filter((state) => state.state === 'failed').length, { timeout: 60_000 })
      .toBeGreaterThan(configurationFailures)
    expect(states.at(-1)?.current?.processId).toBe(importsRecovered.current!.processId)
    expect(() => process.kill(importsRecovered.current!.processId, 0)).not.toThrow()

    await writeFile(libraryConfiguration, libraryOptions)
    await expect
      .poll(() => states.filter((state) => state.state === 'ready').at(-1)?.current?.processId, {
        timeout: 60_000,
      })
      .not.toBe(importsRecovered.current!.processId)
    const dependencyRecovered = states.filter((state) => state.state === 'ready').at(-1)!

    const entry = join(workspace.app, 'src/main/entry.ts')
    const original = await readFile(entry, 'utf8')
    const helper = join(workspace.app, 'src/main/app/development-fixture.ts')
    await writeFile(helper, "export const value = 'synthetic first generation'\n")
    await writeFile(
      entry,
      `${original}\nvoid import('./app/development-fixture').then((module) => console.info(module.value))\n`,
    )
    await expect
      .poll(() => states.filter((state) => state.state === 'ready').at(-1)?.current?.processId, {
        timeout: 60_000,
      })
      .not.toBe(dependencyRecovered.current!.processId)
    const good = states.filter((state) => state.state === 'ready').at(-1)!
    const previousChunks = await readdir(join(good.current!.directory, 'main'))
    const beforeFailure = states.filter((state) => state.state === 'failed').length
    await writeFile(helper, 'export const value =\n')
    await expect
      .poll(() => states.filter((state) => state.state === 'failed').length, { timeout: 60_000 })
      .toBeGreaterThan(beforeFailure)
    expect(states.at(-1)?.current?.processId).toBe(good.current!.processId)
    expect(() => process.kill(good.current!.processId, 0)).not.toThrow()

    const renamed = join(workspace.app, 'src/main/app/renamed-fixture.ts')
    await rename(helper, renamed)
    await writeFile(renamed, "export const value = 'synthetic repaired generation'\n")
    await writeFile(
      entry,
      `${original}\nvoid import('./app/renamed-fixture').then((module) => console.info(module.value))\n`,
    )
    await expect
      .poll(() => states.filter((state) => state.state === 'ready').at(-1)?.current?.processId, {
        timeout: 60_000,
      })
      .not.toBe(good.current!.processId)
    const repaired = states.filter((state) => state.state === 'ready').at(-1)!
    const currentChunks = await readdir(join(repaired.current!.directory, 'main'))
    expect(currentChunks.some((file) => previousChunks.includes(file) && file !== 'entry.js')).toBe(
      false,
    )

    const readyCount = states.filter((state) => state.state === 'ready').length
    const button = join(workspace.root, 'clients/desktop/packages/ui/src/components/button.tsx')
    await writeFile(
      button,
      (await readFile(button, 'utf8')).replace('<button', '<button data-fixture="updated"'),
    )
    await expect
      .poll(() => states.filter((state) => state.state === 'ready').length, { timeout: 60_000 })
      .toBeGreaterThan(readyCount)
    expect(states.filter((state) => state.state === 'ready').at(-1)?.current?.processId).toBe(
      repaired.current!.processId,
    )
    await expect
      .poll(() => page.getByRole('button').getAttribute('data-fixture'), { timeout: 15_000 })
      .toBe('updated')
    expect(await page.locator('main').count()).toBe(1)

    const marker = join(workspace.app, '.local/development/retained.txt')
    await writeFile(marker, 'synthetic retained development state')
    controller.send({ type: 'stop' })
    expect(await closed, diagnostics).toBe(0)
    expect(await readFile(marker, 'utf8')).toBe('synthetic retained development state')
    await expect
      .poll(() => {
        try {
          process.kill(repaired.current!.processId, 0)
          return true
        } catch {
          return false
        }
      })
      .toBe(false)
    await readPnpm(['--filter', '@kisaki3/desktop', 'run', 'clean'], workspace.root)
    await expect(readdir(join(workspace.app, 'out'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(marker, 'utf8')).toBe('synthetic retained development state')
  } catch (cause) {
    throw new Error(`Development workflow failed:\n${diagnostics}`, { cause })
  } finally {
    if (controller.connected) controller.send({ type: 'stop' })
    const timeout = setTimeout(() => controller.kill(), 15_000)
    await closed
    clearTimeout(timeout)
    await browser?.close()
    await workspace.close()
  }
}, 240_000)
