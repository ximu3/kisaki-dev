import { expect, test } from 'vitest'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { OutputInUse, run, withOutputs } from '../../../tools/outputs'

const require = createRequire(import.meta.url)
const loader = pathToFileURL(require.resolve('tsx')).href

/** Stop a fixture process if the operating system has not already ended it with its parent. */
function terminate(pid: number): void {
  try {
    process.kill(pid, 'SIGKILL')
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ESRCH') throw cause
  }
}

test('cancellation closes the owned command and descendant before its output can be reused', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'kisaki-output-process-')))
  const project = join(root, 'project')
  await mkdir(project)
  const controller = new AbortController()
  const operation = withOutputs(
    [{ project, mode: 'use', write: ['dist'] }],
    async () => {
      await run(process.execPath, [
        '--import',
        loader,
        resolve('tests/support/output-worker.ts'),
        root,
        'tree',
      ])
    },
    { root, signal: controller.signal },
  )
  const cancelled = expect(operation).rejects.toMatchObject({ name: 'AbortError' })

  try {
    let processes: { parent: number; leaf: number } | undefined
    await expect
      .poll(
        async () => {
          try {
            processes = JSON.parse(await readFile(join(root, 'tree.json'), 'utf8'))
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
    await withOutputs([{ project, mode: 'use', write: ['dist'] }], async () => undefined, { root })
  } finally {
    controller.abort()
    await operation.catch(() => undefined)
    await rm(root, { recursive: true, force: true })
  }
}, 20_000)

test('terminating the owner does not expose outputs while an inherited child remains alive', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'kisaki-output-orphan-')))
  const project = join(root, 'project')
  await mkdir(project)
  const holder = spawn(
    process.execPath,
    ['--import', loader, resolve('tests/support/output-worker.ts'), root, 'tree'],
    { windowsHide: true, stdio: 'ignore' },
  )
  const closed = new Promise<void>((resolve, reject) => {
    holder.once('error', reject)
    holder.once('close', () => resolve())
  })
  let leaf: number | undefined

  try {
    await expect
      .poll(
        async () => {
          try {
            const tree: { leaf: number } = JSON.parse(
              await readFile(join(root, 'tree.json'), 'utf8'),
            )
            leaf = tree.leaf
            return true
          } catch (cause) {
            if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
            return false
          }
        },
        { timeout: 10_000 },
      )
      .toBe(true)
    holder.kill('SIGKILL')
    await closed

    let childAlive = false
    try {
      process.kill(leaf!, 0)
      childAlive = true
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ESRCH') throw cause
    }
    if (childAlive) {
      await expect(
        withOutputs([{ project, mode: 'use', write: ['dist'] }], async () => undefined, { root }),
      ).rejects.toBeInstanceOf(OutputInUse)
      terminate(leaf!)
    }
    await expect
      .poll(async () => {
        try {
          await withOutputs([{ project, mode: 'use', write: ['dist'] }], async () => undefined, {
            root,
          })
          return true
        } catch (cause) {
          if (!(cause instanceof OutputInUse)) throw cause
          return false
        }
      })
      .toBe(true)
  } finally {
    holder.kill('SIGKILL')
    await closed
    if (leaf) terminate(leaf)
    await rm(root, { recursive: true, force: true })
  }
}, 20_000)
