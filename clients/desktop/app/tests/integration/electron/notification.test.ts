import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { test, expect } from '../../support/electron'
import { buildDirectory } from '../../../tools/lib/paths'
import { hostTarget } from '../../../tools/lib/targets'
import { electronExecutable } from '../../../tools/dev/electron-executable'
import { notificationTarget } from '../../../src/main/infrastructure/notifications/target'

async function fixture(action: 'register' | 'remove' | 'click', value: string) {
  await promisify(execFile)(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-File',
      join(import.meta.dirname, '../../fixtures/notifications/windows.ps1'),
      '-Action',
      action,
      '-Value',
      value,
    ],
    { windowsHide: true },
  )
}

const registered = test.extend({
  profile: async ({ profile }, use) => {
    const entry = join(buildDirectory(hostTarget()), 'main', 'entry.js')
    const command = `"${electronExecutable()}" "${entry}" "--profile=${profile}"`
    await fixture('register', command)
    try {
      await use(profile)
    } finally {
      await fixture('remove', command)
    }
  },
})

registered.describe('disposable Windows notification identity', () => {
  // The external client compiles the SDK interface on this host before invoking COM.
  registered.describe.configure({ timeout: 60_000 })
  registered.skip(
    process.platform !== 'win32' || process.env.RUNNER_ENVIRONMENT !== 'github-hosted',
    'Requires an isolated Windows account for the development COM identity',
  )
  registered('a retained OS payload opens its private native destination', async ({ desktop }) => {
    const window = await desktop.firstWindow()
    await expect(window.getByRole('button', { name: 'Task center' })).toBeVisible()
    await fixture('click', notificationTarget('me.kisaki.dev', { type: 'themes' }))
    await expect(window.getByRole('dialog', { name: 'Themes' })).toBeVisible()
  })
})
