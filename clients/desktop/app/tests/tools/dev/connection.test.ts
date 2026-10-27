import { expect, test } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchDevelopmentApplication } from '@kisaki3/extension-cli/extension'
import {
  parseDevelopmentCommand,
  parseDevelopmentEvent,
} from '@kisaki3/desktop-contracts/development'
import { appRoot } from '../../../tools/lib/paths'

test('shares a pending stop, preserves a cancelled connection and observes exit after explicit disconnect', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'kisaki-development-connection-'))
  const application = await launchDevelopmentApplication({
    executable: process.execPath,
    args: ['--import', 'tsx', 'tests/fixtures/development-application.ts'],
    cwd: appRoot,
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
        args: ['--import', 'tsx', 'tests/fixtures/development-application.ts', '--wrong-version'],
        cwd: appRoot,
        profile,
        startupTimeoutMs: 10_000,
      }),
    ).rejects.toThrow('readiness does not match')
  } finally {
    await rm(profile, { recursive: true, force: true })
  }
})

test('validates finite build facts and rejects removed transport and queue fields', () => {
  expect(
    parseDevelopmentCommand({
      type: 'buildsReady',
      builds: [{ extensionId: 'fixture', buildId: 1, rootPath: '/complete', webviews: [] }],
    }),
  ).toMatchObject({ type: 'buildsReady' })
  expect(
    parseDevelopmentEvent({
      type: 'adoptionResult',
      outcome: 'completed',
      builds: [{ extensionId: 'fixture', buildId: 1, outcome: 'adopted' }],
      activations: [
        {
          extensionId: 'fixture',
          outcome: 'failed',
          error: { code: 'fixture', message: 'Fixture failure' },
        },
      ],
    }),
  ).toMatchObject({ outcome: 'completed' })
  expect(() => parseDevelopmentCommand({ type: 'stop', requestId: 'removed' })).toThrow()
  expect(() =>
    parseDevelopmentCommand({ type: 'initialize', protocolVersion: 1, sessionId: 'removed' }),
  ).toThrow()
  expect(() =>
    parseDevelopmentEvent({
      type: 'adoptionResult',
      outcome: 'completed',
      builds: [{ extensionId: 'fixture', buildId: 1, outcome: 'superseded' }],
      activations: [],
    }),
  ).toThrow()
})
