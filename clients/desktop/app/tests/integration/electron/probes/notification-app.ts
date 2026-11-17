/** @fileoverview Receives a real notification activation on the test's private Linux desktop and session bus. */

import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { app } from 'electron'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import { createNotifications } from '../../../../src/main/infrastructure/notifications'
import { readNotificationTarget } from '../../../../src/main/infrastructure/notifications/target'
import { receivePortalAction, verifyPortalHandoff } from './notification-portal'

/** The fresh receiver has its own profile even when the session bus launches it from another directory. */
const restoring = process.argv.includes('--restore-notification')
const profile = join(process.env.XDG_DATA_HOME!, restoring ? 'receiver' : 'sender')
mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)

/** Submits a task destination, activates the delivered item through dunst and checks the returned target. */
async function activate() {
  await app.whenReady()
  if (restoring) {
    await receivePortalAction()
    return
  }
  const clicked = Promise.withResolvers<NativeViewTarget>()
  const appId = 'me.kisaki.dev'
  const notifications = createNotifications(appId, {
    /** Ordinary application launches do not acknowledge notification clicks. */
    activate: () => assert.fail('Unexpected plain activation'),
    /** A notification does not use the public deeplink receiver. */
    openUrl: () => assert.fail('Unexpected URL activation'),
    /** Checks the same private OS payload consumed by a restarted application. */
    notification(value) {
      const target = readNotificationTarget(appId, value)
      assert.ok(target)
      clicked.resolve(target)
    },
  })
  const target = { type: 'tasks', runId: 'notification-sample' } as const
  try {
    const result = await notifications.show({
      title: 'Sample task',
      body: 'Completed',
      open: target,
    })
    assert.equal(result, 'accepted')
    await promisify(execFile)('dunstctl', ['action', '0'])
    assert.deepEqual(await clicked.promise, target)
  } finally {
    await notifications.close()
  }
  await verifyPortalHandoff(target)
}

/** Ends the owned process and its private bus if the notification service never answers. */
const deadline = setTimeout(() => {
  console.error('The notification service did not complete activation')
  app.exit(1)
}, 12_000)

void activate()
  .then(
    () => app.quit(),
    (cause: unknown) => {
      console.error(cause)
      app.exit(1)
    },
  )
  .finally(() => clearTimeout(deadline))
