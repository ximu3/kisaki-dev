import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isCancellation } from '@kisaki3/tooling/errors'
import { run } from '@kisaki3/tooling/process'
import { electronExecutable } from '../../../tools/dev/electron-executable'
import { test as desktopTest } from '../../support/electron'
import { buildProbe } from './probes/build'

type NotificationMode = 'desktop-action' | 'portal-handoff'

const test = desktopTest.extend<{
  runNotification: (mode: NotificationMode) => Promise<void>
}>({
  runNotification: async ({ profile }, use, info) => {
    const entry = await test.step('Build the notification probe', () =>
      buildProbe(profile, 'notifications/app.ts'))
    const executable = electronExecutable()
    const data = join(profile, 'data')
    const log = info.outputPath('notification.log')
    await writeFile(log, 'Notification probe built\n')
    const controller = new AbortController()
    let active: Promise<void> | undefined

    try {
      await use(async (mode) => {
        if (mode === 'portal-handoff') {
          const services = join(data, 'dbus-1', 'services')
          await mkdir(services, { recursive: true })
          await writeFile(
            join(services, 'me.kisaki.dev.service'),
            `[D-BUS Service]\nName=me.kisaki.dev\nExec="${executable}" "${entry}" --restore-notification\n`,
          )
        }
        active = run(
          'xvfb-run',
          ['--auto-servernum', 'dbus-run-session', '--', executable, entry, '--' + mode],
          {
            cwd: profile,
            signal: controller.signal,
            env: {
              ...process.env,
              ELECTRON_RUN_AS_NODE: undefined,
              KISAKI_NOTIFICATION_LOG: log,
              XDG_DATA_HOME: data,
              XDG_CONFIG_HOME: join(profile, 'config'),
              XDG_CACHE_HOME: join(profile, 'cache'),
            },
          },
        )
        try {
          await active
        } finally {
          active = undefined
        }
      })
    } finally {
      try {
        if (active) {
          controller.abort()
          await active.catch((error: unknown) => {
            if (!isCancellation(error, controller.signal)) {
              throw error
            }
          })
        }
      } finally {
        if (info.status !== info.expectedStatus) {
          console.error(await readFile(log, 'utf8'))
          await info.attach('notification stages', { path: log, contentType: 'text/plain' })
        }
      }
    }
  },
})

test.describe('Linux system notifications', () => {
  test.skip(process.platform !== 'linux', 'Requires an isolated Linux display and session bus')

  test('the displayed notification delivers its desktop action', async ({ runNotification }) => {
    await runNotification('desktop-action')
  })

  test('a saved portal action activates a new receiver', async ({ runNotification }) => {
    await runNotification('portal-handoff')
  })
})
