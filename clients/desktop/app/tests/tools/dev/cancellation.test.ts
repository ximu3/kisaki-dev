/** @fileoverview Checks session shutdown outcomes at the command boundary without starting external tools. */

import { expect, test, vi } from 'vite-plus/test'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareResources } from '../../../tools/resources/prepare'
import { startDevelopmentSession } from '../../../tools/dev/session'
import { hostTarget } from '../../../tools/lib/targets'

/** Redirects the session's outputs to the test-owned root. */
const paths = vi.hoisted(() => ({ appRoot: process.cwd(), repositoryRoot: process.cwd() }))
vi.mock('../../../tools/lib/paths', () => paths)
vi.mock('../../../tools/resources/prepare', () => ({ prepareResources: vi.fn() }))
vi.mock('../../../tools/dev/electron-executable', () => ({ electronExecutable: vi.fn() }))
vi.mock('../../../tools/dev/renderer', () => ({
  startRenderer: vi.fn().mockResolvedValue({
    resolvedUrls: { local: ['http://localhost'] },
    close: vi.fn().mockResolvedValue(undefined),
  }),
}))
vi.mock('../../../tools/dev/inputs', () => ({
  startInputWatcher: vi.fn().mockResolvedValue({ close: vi.fn().mockResolvedValue(undefined) }),
}))

test.each(['cancelled', 'failed'] as const)(
  'initial command %s settles teardown once and never launches',
  async (outcome) => {
    const root = await mkdtemp(join(tmpdir(), 'kisaki-session-'))
    paths.appRoot = root
    paths.repositoryRoot = root
    const started = Promise.withResolvers<void>()
    const failure = new Error('Preparation failed while stopping')
    vi.mocked(prepareResources).mockImplementationOnce(
      (_target, signal) =>
        new Promise((_resolve, reject) => {
          signal!.addEventListener(
            'abort',
            () => reject(outcome === 'failed' ? failure : signal!.reason),
            { once: true },
          )
          started.resolve()
        }),
    )
    /** Detects adoption of an application after its preparation has been cancelled. */
    const launch = vi.fn()
    try {
      const session = await startDevelopmentSession({ sourceRoot: root, launch })
      await started.promise
      if (outcome === 'failed') {
        await expect(session.stop()).rejects.toBe(failure)
        await expect(session.closed).rejects.toBe(failure)
        await expect(session.terminate()).rejects.toBe(failure)
      } else {
        await expect(session.stop()).resolves.toBe('stopped')
        await session.closed
      }
      expect(launch).not.toHaveBeenCalled()
      expect(await readdir(join(root, 'out/development', hostTarget()))).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  },
)
