import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { app } from 'electron'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import { createNotifications } from '../../../../../src/main/infrastructure/notifications'
import { readNotificationTarget } from '../../../../../src/main/infrastructure/notifications/target'
import { record } from './progress'
import { receivePortalAction, verifyPortalHandoff } from './portal'

const restoring = process.argv.includes('--restore-notification')

const profile = join(process.env.XDG_DATA_HOME!, restoring ? 'receiver' : 'sender')

mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)

const target = { type: 'tasks', runId: 'notification-sample' } as const
const execute = promisify(execFile)

async function verifyDesktopAction() {
  record('Waiting for the notification daemon')
  assert.equal((await execute('dunstctl', ['count', 'displayed'])).stdout.trim(), '0')
  const clicked = Promise.withResolvers<NativeViewTarget>()
  const appId = 'me.kisaki.dev'
  const notifications = createNotifications(appId, {
    activate: () => assert.fail('Unexpected plain activation'),
    openUrl: () => assert.fail('Unexpected URL activation'),
    notification(value) {
      const target = readNotificationTarget(appId, value)
      assert.ok(target)
      clicked.resolve(target)
    },
  })
  try {
    record('Submitting desktop notification')
    const result = await notifications.show({
      title: 'Sample task',
      body: 'Completed',
      open: target,
    })
    assert.equal(result, 'accepted')
    record('Desktop notification accepted, waiting for display')
    for (;;) {
      const { stdout } = await execute('dunstctl', ['count', 'displayed'])
      if (stdout.trim() === '1') {
        break
      }
      assert.equal(stdout.trim(), '0', 'Expected only the notification from this probe')
      await delay(50)
    }
    record('Activating the displayed notification')
    await execute('dunstctl', ['action', '0'])
    record('Waiting for the Electron click callback')
    assert.deepEqual(await clicked.promise, target)
  } finally {
    await notifications.close()
  }
  record('Desktop notification callback verified and service closed')
}

async function activate() {
  record(restoring ? 'Starting restored receiver' : 'Starting notification sender')
  await app.whenReady()
  record('Electron ready')
  if (restoring) {
    await receivePortalAction()
  } else if (process.argv.includes('--portal-handoff')) {
    await verifyPortalHandoff(target)
  } else {
    await verifyDesktopAction()
  }
}

app.once('quit', () => record('Electron quitting'))
void activate().then(
  () => app.quit(),
  (cause: unknown) => {
    record(cause instanceof Error ? (cause.stack ?? cause.message) : String(cause))
    console.error(cause)
    app.exit(1)
  },
)
