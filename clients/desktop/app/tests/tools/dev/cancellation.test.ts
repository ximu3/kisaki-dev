/**
 * @fileoverview Verifies that cancelled dependency preparation closes its command and
 * allows a fresh development startup.
 */

import { expect, test } from 'vitest'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { hostTarget } from '../../../tools/lib/targets'
import { prepareDevelopmentWorkspace } from '../../support/development-workspace'
import {
  developmentStartupTimeoutMs,
  startDevelopmentController,
} from '../../support/development-controller'

test('cancelling initial dependency preparation closes its command and permits a complete retry', async () => {
  const workspace = await prepareDevelopmentWorkspace()
  let first: ReturnType<typeof startDevelopmentController> | undefined
  let retry: ReturnType<typeof startDevelopmentController> | undefined
  try {
    const manifestPath = join(workspace.root, 'clients/desktop/packages/ui/package.json')
    const original = await readFile(manifestPath, 'utf8')
    const manifest = JSON.parse(original) as { scripts: Record<string, string> }
    manifest.scripts.build = 'tsx ../../app/tests/support/preparation-worker.ts'
    await writeFile(manifestPath, JSON.stringify(manifest))

    first = startDevelopmentController(workspace.app)
    const sessions = join(workspace.app, 'out', 'development', hostTarget())
    let preparation: { pid: number } | undefined
    await expect
      .poll(
        async () => {
          try {
            preparation = JSON.parse(
              await readFile(join(workspace.root, '.cache', 'dependency-preparation.json'), 'utf8'),
            ) as typeof preparation
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
    expect(await first.closed, first.diagnostics()).toBe(0)
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
    retry = startDevelopmentController(workspace.app)
    await expect
      .poll(() => retry!.states.some((state) => state.state === 'ready'), {
        timeout: developmentStartupTimeoutMs,
      })
      .toBe(true)

    retry.process.send({ type: 'stop' })
    expect(await retry.closed, retry.diagnostics()).toBe(0)
    expect(await readdir(sessions)).toEqual([])
  } finally {
    for (const item of [first, retry]) {
      if (!item) {
        continue
      }

      await item.close()
    }

    await workspace.close()
  }
})
