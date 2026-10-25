import { afterEach, beforeEach, expect, test } from 'vitest'
import { createRequire } from 'node:module'
import type { ChildProcess } from 'node:child_process'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { acquireOutputs, spawnWithOutputs, withOutputs } from '../../../tools/outputs'
import type { OutputRequest } from '../../../tools/outputs'

const require = createRequire(import.meta.url)
const loader = pathToFileURL(require.resolve('tsx')).href
const worker = resolve('tests/support/output-worker.ts')
let root: string
let project: string
const children = new Set<ChildProcess>()

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'kisaki-output-access-'))
  project = join(root, 'project')
  await mkdir(project)
})
afterEach(async () => {
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue
    const closed = new Promise<void>((resolve) => child.once('close', () => resolve()))
    child.kill('SIGKILL')
    await closed
  }
  children.clear()
  await rm(root, { recursive: true, force: true })
})

/** Start a real Node participant; messages only coordinate the controlled test interleaving. */
function start(role: string): ChildProcess {
  const child = spawnWithOutputs(process.execPath, ['--import', loader, worker, root, role], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  children.add(child)
  return child
}

/** Wait for actual lock acquisition, rejecting an early worker exit with its diagnostics. */
function ready(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    let errors = ''
    child.stderr?.setEncoding('utf8').on('data', (value: string) => {
      errors += value
    })
    const exited = (code: number | null) =>
      reject(new Error(`Worker exited before acquisition (${code}): ${errors}`))
    child.once('error', reject)
    child.once('exit', exited)
    child.once('message', (message: unknown) => {
      if (
        !message ||
        typeof message !== 'object' ||
        !('ready' in message) ||
        message.ready !== true
      ) {
        reject(new Error('Unexpected worker observation'))
        return
      }
      child.off('exit', exited)
      resolve()
    })
  })
}

test('readers share one output while writers and project cleanup are excluded', async () => {
  const request: OutputRequest[] = [{ project, mode: 'use', read: ['dist'] }]
  const first = await acquireOutputs(request, { root })
  const second = await acquireOutputs(request, { root })
  try {
    await expect(
      withOutputs([{ project, mode: 'use', write: ['dist'] }], async () => undefined, { root }),
    ).rejects.toMatchObject({ code: 'OUTPUT_IN_USE' })
    await expect(
      withOutputs([{ project, mode: 'clean' }], async () => undefined, { root }),
    ).rejects.toMatchObject({ code: 'OUTPUT_IN_USE' })
  } finally {
    await second.close()
    await first.close()
  }
  await withOutputs([{ project, mode: 'clean' }], async () => undefined, { root })
})

test('independent output writers can overlap without a workspace-wide mutex', async () => {
  const first = await acquireOutputs([{ project, mode: 'use', write: ['dist'] }], { root })
  const second = await acquireOutputs([{ project, mode: 'use', write: ['out'] }], { root })
  try {
    await first.run(async () => {
      await withOutputs([{ project, mode: 'use', read: ['dist'] }], async () => undefined, { root })
    })
  } finally {
    await second.close()
    await first.close()
  }
})

test('cancelling acquisition does not enter or retain a partial output scope', async () => {
  const held = await acquireOutputs([{ project, mode: 'use', write: ['dist'] }], { root })
  const controller = new AbortController()
  let waiting!: () => void
  const blocked = new Promise<void>((resolve) => {
    waiting = resolve
  })
  let entered = false
  const pending = withOutputs(
    [{ project, mode: 'use', read: ['dist'], write: ['out'] }],
    async () => {
      entered = true
    },
    { root, signal: controller.signal, wait: true, onWaiting: waiting },
  )
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  try {
    await blocked
    controller.abort()
    await rejected
    expect(entered).toBe(false)
    await withOutputs([{ project, mode: 'use', write: ['out'] }], async () => undefined, { root })
  } finally {
    await held.close()
  }
})

test('a child borrows declared access and cannot weaken the live parent lock', async () => {
  await withOutputs(
    [{ project, mode: 'use', write: ['dist'] }],
    async () => {
      const inherited = start('inherited')
      const inheritedClosed = new Promise<number | null>((resolve) =>
        inherited.once('close', resolve),
      )
      await ready(inherited)
      expect(await inheritedClosed).toBe(0)

      const independent = start('independent')
      const code = await new Promise<number | null>((resolve) => independent.once('close', resolve))
      expect(code).not.toBe(0)
    },
    { root },
  )
})

test('terminating a lock holder leaves no directory marker that prevents retry', async () => {
  const holder = start('hold')
  await ready(holder)
  await expect(
    withOutputs([{ project, mode: 'use', write: ['dist'] }], async () => undefined, { root }),
  ).rejects.toMatchObject({ code: 'OUTPUT_IN_USE' })
  const closed = new Promise<void>((resolve) => holder.once('close', () => resolve()))
  holder.kill('SIGKILL')
  await closed
  await withOutputs([{ project, mode: 'use', write: ['dist'] }], async () => undefined, { root })
})
