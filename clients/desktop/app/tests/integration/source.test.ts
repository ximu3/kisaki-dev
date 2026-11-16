/** @fileoverview Verifies the formal source application's readiness, selected data root and normal process exit. */

import { test, expect } from 'vite-plus/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { startDevelopmentSession } from '../../tools/dev/session'
import { launchApplication } from '../../tools/dev/application'
import { appRoot } from '../../tools/lib/paths'
import { hostTarget } from '../../tools/lib/targets'
import { hasNativeWindow } from '../support/window-observation'

test('the source session opens its own migrated library and releases it on normal stop', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'kisaki-source-'))
  const target = hostTarget()
  const failed = Promise.withResolvers<never>()
  void failed.promise.catch(() => {})
  const session = await startDevelopmentSession({
    sourceRoot: appRoot,
    profile,
    launch: launchApplication,
    /** Reports a failed immutable source candidate directly to the waiting test. */
    onState(state, error) {
      if (state === 'failed') {
        failed.reject(error)
      }
    },
    prepared: {
      resources: join(appRoot, 'out/resources', target),
      nativeBinding: join(appRoot, 'out/native', target, 'kisaki-native.node'),
    },
  })
  try {
    await Promise.race([session.ready, failed.promise])
    expect(await hasNativeWindow(session.current!.processId)).toBe(true)
    await expect(session.stop()).resolves.toBe('stopped')
    const db = new Database(join(profile, 'library.sqlite'), { readonly: true })
    try {
      expect(db.prepare('select count(*) from __drizzle_migrations').pluck().get()).toBeGreaterThan(
        0,
      )
    } finally {
      db.close()
    }
  } finally {
    await session.terminate()
    await rm(profile, { recursive: true, force: true, maxRetries: 4 })
  }
})
