/**
 * @fileoverview Exercises explicit command environments and cancellation of real
 * child-process trees.
 */

import { expect, test, vi } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { run } from '@kisaki3/tooling/process'

const require = createRequire(import.meta.url)
const loader = pathToFileURL(require.resolve('tsx')).href

test('an explicit environment preserves removals from the parent environment', async () => {
  vi.stubEnv('KISAKI_COMMAND_REMOVED', 'parent-only')
  const env: NodeJS.ProcessEnv = { ...process.env, KISAKI_COMMAND_RETAINED: 'child-value' }
  delete env.KISAKI_COMMAND_REMOVED

  try {
    await run(
      process.execPath,
      ['--import', loader, resolve('tests/support/environment-worker.ts')],
      {
        env,
      },
    )
  } finally {
    vi.unstubAllEnvs()
  }
})

test('cancelling a command waits for the command and its descendant to exit', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kisaki-command-'))
  const controller = new AbortController()

  const operation = run(
    process.execPath,
    ['--import', loader, resolve('tests/support/command-worker.ts'), directory],
    { signal: controller.signal },
  )
  const cancelled = expect(operation).rejects.toMatchObject({ name: 'AbortError' })

  try {
    let processes: { parent: number; leaf: number } | undefined
    await expect
      .poll(
        async () => {
          try {
            processes = JSON.parse(await readFile(join(directory, 'tree.json'), 'utf8'))
            return true
          } catch (cause) {
            if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
            return false
          }
        },
        { timeout: 10_000 },
      )
      .toBe(true)

    controller.abort()
    await cancelled

    expect(processes).toBeDefined()
    for (const pid of [processes!.parent, processes!.leaf]) {
      await expect
        .poll(() => {
          try {
            process.kill(pid, 0)
            return true
          } catch (cause) {
            if ((cause as NodeJS.ErrnoException).code !== 'ESRCH') throw cause
            return false
          }
        })
        .toBe(false)
    }
  } finally {
    controller.abort()
    await operation.catch(() => undefined)

    await rm(directory, { recursive: true, force: true })
  }
}, 20_000)
