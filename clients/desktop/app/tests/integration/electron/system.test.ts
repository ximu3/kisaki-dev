/** @fileoverview Checks the visible system-integration state and exercises registrations only in isolated OS scopes. */

import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { test, expect } from '../../support/electron'
import { buildDirectory } from '../../../tools/lib/paths'
import { hostTarget } from '../../../tools/lib/targets'

test('system integration reports the selected data root from the actual native application', async ({
  desktop,
  profile,
}) => {
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Application menu' }).click()
  await page.getByRole('menuitem', { name: 'System integration' }).click()
  await expect(page.getByRole('dialog').getByText(profile, { exact: true })).toBeVisible()
})

test.describe('disposable OS account', () => {
  test.skip(
    process.platform === 'darwin' || process.env.RUNNER_ENVIRONMENT !== 'github-hosted',
    'Requires a disposable OS account and a handler that can register the source executable',
  )
  test('a system login registration can be removed and the registered scheme delivers to the running window', async ({
    desktop,
    profile,
  }) => {
    const page = await desktop.firstWindow()
    await page.getByRole('button', { name: 'Application menu' }).click()
    await page.getByRole('menuitem', { name: 'System integration' }).click()
    const settings = page.getByRole('dialog', { name: 'System integration' })
    const login = settings.getByRole('checkbox', { name: 'Start at login' })
    await expect(login).not.toBeChecked()
    const args = [join(buildDirectory(hostTarget()), 'main', 'entry.js'), '--profile=' + profile]
    try {
      await login.click()
      await expect(login).toBeChecked()
      await login.click()
      await expect(login).not.toBeChecked()
      await settings.getByRole('button', { name: 'Register', exact: true }).click()
      await expect(settings.getByText(/^Configured ·/)).toBeVisible()
      if (process.platform === 'linux') {
        // Observe the external desktop dispatcher's exit as well as delivery to the actual window.
        await promisify(execFile)('xdg-open', ['kisaki-dev://view/tasks'], {
          env: {
            ...process.env,
            XDG_CONFIG_HOME: join(profile, 'xdg/config'),
            XDG_DATA_HOME: join(profile, 'xdg/data'),
          },
          timeout: 15_000,
        })
      } else {
        await desktop.evaluate(async ({ shell }) => {
          await shell.openExternal('kisaki-dev://view/tasks')
        })
      }
      await expect(page.getByRole('dialog', { name: 'Task center' })).toBeVisible()
    } finally {
      if (process.platform === 'win32') {
        await desktop.evaluate(({ app }, args) => {
          app.setLoginItemSettings({
            openAtLogin: false,
            path: process.execPath,
            args: [...args, '--login'],
          })
          if (app.isDefaultProtocolClient('kisaki-dev', process.execPath, args)) {
            app.removeAsDefaultProtocolClient('kisaki-dev', process.execPath, args)
          }
        }, args)
      }
    }
  })
})
