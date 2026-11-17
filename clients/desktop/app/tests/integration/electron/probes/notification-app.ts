/** @fileoverview Receives a real notification activation on the test's private Linux desktop and session bus. */

import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import { createNotifications } from '../../../../src/main/infrastructure/notifications'

app.setPath('userData', process.cwd())

/** Submits a task destination, activates the delivered item through dunst and checks the returned target. */
async function activate() {
  await app.whenReady()
  const clicked = Promise.withResolvers<NativeViewTarget>()
  const notifications = createNotifications(async (target) => clicked.resolve(target))
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
    notifications.close()
  }
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
