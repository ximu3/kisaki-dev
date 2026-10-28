/**
 * @fileoverview Verifies launcher readiness, shared stop requests and the distinction
 * between IPC closure and process exit.
 */

import { expect, test } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchDevelopmentApplication } from '../../src/extension'

const packageRoot = fileURLToPath(new URL('../..', import.meta.url))
const applicationFixture = fileURLToPath(
  new URL('../fixtures/development-application.ts', import.meta.url),
)

test('shares a pending stop, preserves a cancelled connection and observes exit after explicit disconnect', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'kisaki-development-connection-'))
  const application = await launchDevelopmentApplication({
    executable: process.execPath,
    args: ['--import', 'tsx', applicationFixture],
    cwd: packageRoot,
    profile,
    startupTimeoutMs: 10_000,
  })
  try {
    expect(application.ready.apiVersion).toBeNull()

    const stop = application.stop()
    expect(application.stop()).toBe(stop)
    expect(await stop).toBe('cancelled')
    expect(() => process.kill(application.pid, 0)).not.toThrow()

    expect(await application.stop()).toBe('exited')
    expect(await application.exited).toEqual({ code: 0, signal: null })
  } finally {
    await application.terminate()
    await rm(profile, { recursive: true, force: true })
  }
})

test('rejects unsupported application readiness', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'kisaki-development-version-'))
  try {
    await expect(
      launchDevelopmentApplication({
        executable: process.execPath,
        args: ['--import', 'tsx', applicationFixture, '--wrong-version'],
        cwd: packageRoot,
        profile,
        startupTimeoutMs: 10_000,
      }),
    ).rejects.toThrow('readiness does not match')
  } finally {
    await rm(profile, { recursive: true, force: true })
  }
})
