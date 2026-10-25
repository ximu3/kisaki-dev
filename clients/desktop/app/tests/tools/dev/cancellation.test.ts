import { expect, test } from 'vitest'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { hostTarget } from '../../../tools/lib/targets'
import { prepareDevelopmentWorkspace } from '../../support/development-workspace'

/** An isolated controller reports test observations through its private IPC channel. */
function controller(app: string): {
  process: ChildProcess
  closed: Promise<number | null>
  states: string[]
  diagnostics(): string
} {
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'tests/support/development-controller.ts'],
    {
      cwd: app,
      windowsHide: true,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    },
  )
  let output = ''
  const states: string[] = []
  child.stdout!.setEncoding('utf8').on('data', (value: string) => {
    output = (output + value).slice(-16_384)
  })
  child.stderr!.setEncoding('utf8').on('data', (value: string) => {
    output = (output + value).slice(-16_384)
  })
  child.on('message', (message: unknown) => {
    if (
      message &&
      typeof message === 'object' &&
      'state' in message &&
      typeof message.state === 'string'
    ) {
      states.push(message.state)
    }
  })
  const closed = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', resolve)
  })
  return { process: child, closed, states, diagnostics: () => output }
}

test('cancelling initial dependency preparation closes its command and permits a complete retry', async () => {
  const workspace = await prepareDevelopmentWorkspace()
  let first: ReturnType<typeof controller> | undefined
  let retry: ReturnType<typeof controller> | undefined
  try {
    const manifestPath = join(workspace.root, 'clients/desktop/packages/ui/package.json')
    const original = await readFile(manifestPath, 'utf8')
    const manifest: { scripts: Record<string, string> } = JSON.parse(original)
    manifest.scripts.build = 'tsx ../../app/tests/support/preparation-worker.ts'
    await writeFile(manifestPath, JSON.stringify(manifest))
    first = controller(workspace.app)
    const sessions = join(workspace.app, 'out', 'development', hostTarget())
    let preparation: { pid: number } | undefined
    await expect
      .poll(
        async () => {
          try {
            preparation = JSON.parse(
              await readFile(join(workspace.root, '.cache', 'dependency-preparation.json'), 'utf8'),
            )
            return true
          } catch (cause) {
            if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
            return false
          }
        },
        { timeout: 60_000 },
      )
      .toBe(true)
    first.process.send({ type: 'stop' })
    expect(await first.closed, first.diagnostics()).toBe(0)
    expect(first.states).not.toContain('ready')
    expect(await readdir(sessions)).toEqual([])
    expect(preparation).toBeDefined()
    await expect
      .poll(() => {
        try {
          process.kill(preparation!.pid, 0)
          return true
        } catch (cause) {
          if ((cause as NodeJS.ErrnoException).code !== 'ESRCH') throw cause
          return false
        }
      })
      .toBe(false)

    await writeFile(manifestPath, original)
    retry = controller(workspace.app)
    await expect.poll(() => retry!.states.includes('ready'), { timeout: 120_000 }).toBe(true)
    retry.process.send({ type: 'stop' })
    expect(await retry.closed, retry.diagnostics()).toBe(0)
    expect(await readdir(sessions)).toEqual([])
  } finally {
    for (const item of [first, retry]) {
      if (!item) continue
      if (item.process.connected) item.process.send({ type: 'stop' })
      const timeout = setTimeout(() => item.process.kill('SIGKILL'), 15_000)
      await item.closed
      clearTimeout(timeout)
    }
    await workspace.close()
  }
})
