import { expect, onTestFinished, test, vi } from 'vite-plus/test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { run } from '@kisaki3/tooling/process'

test('an explicit environment preserves removals from the parent environment', async () => {
  vi.stubEnv('KISAKI_COMMAND_REMOVED', 'parent-only')
  const env: NodeJS.ProcessEnv = { ...process.env, KISAKI_COMMAND_RETAINED: 'child-value' }
  delete env.KISAKI_COMMAND_REMOVED

  try {
    await run(process.execPath, [resolve('tests/support/environment-worker.ts')], {
      env,
    })
  } finally {
    vi.unstubAllEnvs()
  }
})

test('cancelling a command waits for the command and its descendant to exit', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kisaki-command-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))
  const controller = new AbortController()

  const operation = run(process.execPath, [resolve('tests/support/command-worker.ts'), directory], {
    signal: controller.signal,
  })
  const cancelled = expect(operation).rejects.toMatchObject({ name: 'AbortError' })
  onTestFinished(async () => {
    controller.abort()
    await operation.catch(() => undefined)
  })

  const processes = await vi.waitUntil(
    async () => {
      try {
        return JSON.parse(await readFile(join(directory, 'tree.json'), 'utf8')) as {
          parent: number
          leaf: number
        }
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw cause
        }
        return undefined
      }
    },
    { timeout: 10_000 },
  )

  controller.abort()
  await cancelled

  for (const pid of [processes.parent, processes.leaf]) {
    await expect
      .poll(() => {
        try {
          process.kill(pid, 0)
          return true
        } catch (cause) {
          if ((cause as NodeJS.ErrnoException).code !== 'ESRCH') {
            throw cause
          }
          return false
        }
      })
      .toBe(false)
  }
}, 20_000)
