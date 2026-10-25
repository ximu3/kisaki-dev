import { expect, test } from 'vitest'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { acquireOutputs, withOutputs } from '../../../../../../tools/outputs'
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

test('cancelling initial dependency acquisition releases the session and permits a complete retry', async () => {
  const workspace = await prepareDevelopmentWorkspace()
  const blocker = await acquireOutputs(
    [
      {
        project: join(workspace.root, 'clients/desktop/packages/ui'),
        mode: 'use',
        write: ['dist'],
      },
    ],
    { root: workspace.root },
  )
  const first = controller(workspace.app)
  let retry: ReturnType<typeof controller> | undefined
  try {
    const sessions = join(workspace.app, 'out', 'development', hostTarget())
    await expect
      .poll(
        async () => {
          try {
            return (await readdir(sessions)).length
          } catch (cause) {
            if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
            return 0
          }
        },
        { timeout: 30_000 },
      )
      .toBe(1)
    first.process.send({ type: 'stop' })
    expect(await first.closed, first.diagnostics()).toBe(0)
    expect(first.states).not.toContain('ready')
    expect(await readdir(sessions)).toEqual([])
    await withOutputs([{ project: workspace.app, mode: 'clean' }], async () => undefined, {
      root: workspace.root,
    })

    await blocker.close()
    retry = controller(workspace.app)
    await expect.poll(() => retry!.states.includes('ready'), { timeout: 120_000 }).toBe(true)
    retry.process.send({ type: 'stop' })
    expect(await retry.closed, retry.diagnostics()).toBe(0)
    expect(await readdir(sessions)).toEqual([])
  } finally {
    await blocker.close()
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
