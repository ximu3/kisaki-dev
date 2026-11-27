import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { test, expect } from '../../support/electron'
import { buildDirectory } from '../../../tools/lib/paths'
import { hostTarget } from '../../../tools/lib/targets'
import { electronExecutable } from '../../../tools/dev/electron-executable'

test('system integration reports the selected data root from the actual native application', async ({
  desktop,
  profile,
}) => {
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Application menu' }).click()
  await page.getByRole('menuitem', { name: 'System integration' }).click()
  const settings = page.getByRole('dialog', { name: 'System integration' })
  await expect(settings.getByRole('switch', { name: 'Start at login' })).toBeVisible()
  await expect(settings.getByRole('button', { name: 'Startup settings' })).toHaveCount(0)
  await expect(settings.getByText(profile, { exact: true })).toBeVisible()
})

test('About retries a failed environment read within the open dialog', async ({ desktop }) => {
  const page = await desktop.firstWindow()
  await desktop.evaluate(() => {
    const version = process.getSystemVersion.bind(process)
    process.getSystemVersion = () => {
      process.getSystemVersion = version
      throw new Error('Environment read failed')
    }
  })
  await page.getByRole('button', { name: 'Application menu' }).click()
  await page.getByRole('menuitem', { name: 'About Kisaki', exact: true }).click()
  const about = page.getByRole('dialog', { name: 'About Kisaki', exact: true })
  const copy = about.getByRole('button', { name: 'Copy environment information' })
  await expect(copy).toBeDisabled()
  await about.getByRole('alert').getByRole('button', { name: 'Retry' }).click()
  await expect(copy).toBeEnabled()
  await expect(about.getByRole('alert')).toHaveCount(0)
  await expect(about.getByText(process.arch, { exact: true })).toBeVisible()
})

test('a second launch reveals the hidden draft before navigating to its destination', async ({
  desktop,
  profile,
}) => {
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Application menu' }).click()
  await page.getByRole('menuitem', { name: 'Preferences', exact: true }).click()
  const preferences = page.getByRole('dialog', { name: 'Preferences', exact: true })
  await preferences.getByRole('tab', { name: 'Appearance', exact: true }).click()
  await preferences.getByRole('spinbutton', { name: 'Interface scale' }).fill('120')

  const visible = () =>
    desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isVisible())
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close())
  await expect.poll(visible).toBe(false)
  await promisify(execFile)(electronExecutable(), [
    join(buildDirectory(hostTarget()), 'main', 'entry.js'),
    '--profile=' + profile,
    'kisaki-dev://view/tasks',
  ])

  await expect.poll(visible).toBe(true)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
  await expect(page.getByRole('dialog', { name: 'Task center', exact: true })).toBeVisible()
})

test('a superseded navigation retains the task center and its selected tab', async ({
  desktop,
  profile,
}) => {
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Task center' }).click()
  const finished = page.getByRole('tab', { name: 'Finished', exact: true })
  await finished.click()

  function open(target: string) {
    return promisify(execFile)(electronExecutable(), [
      join(buildDirectory(hostTarget()), 'main', 'entry.js'),
      '--profile=' + profile,
      'kisaki-dev://view/' + target,
    ])
  }

  const [waitingDialog] = await Promise.all([
    page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          function hold(event: ToggleEvent) {
            if (event.target instanceof HTMLDialogElement && event.newState === 'open') {
              event.preventDefault()
              document.removeEventListener('beforetoggle', hold, true)
              resolve(event.target.id)
            }
          }
          document.addEventListener('beforetoggle', hold, true)
        }),
    ),
    open('preferences'),
  ])
  await open('tasks')
  await expect
    .poll(() => page.evaluate((id) => !!document.getElementById(id), waitingDialog))
    .toBe(false)
  await expect(finished).toHaveAttribute('aria-selected', 'true')
  await expect(finished).toBeFocused()

  await open('preferences')
  const preferences = page.getByRole('dialog', { name: 'Preferences', exact: true })
  await preferences.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Task center' })).toBeFocused()
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
    const login = settings.getByRole('switch', { name: 'Start at login' })
    await expect(login).not.toBeChecked()
    const args = [join(buildDirectory(hostTarget()), 'main', 'entry.js'), '--profile=' + profile]
    try {
      await login.click()
      await expect(login).toBeChecked()
      await login.click()
      await expect(login).not.toBeChecked()
      const protocol = settings.getByRole('group', { name: 'Kisaki links' })
      await protocol.getByRole('button', { name: 'Register', exact: true }).click()
      await expect(
        protocol.getByText(/opens kisaki-dev:\/\/ links|kisaki-dev:\/\/ is registered/),
      ).toBeVisible()
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
