/** @fileoverview Exercises the real window shell, scoped native documents and durable preference edits. */

import { test, expect } from '../../support/electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appRoot } from '../../../tools/lib/paths'
import { hostTarget } from '../../../tools/lib/targets'

for (const kind of ['main', 'reader', 'player', 'game-panel'] as const) {
  test.describe(kind, () => {
    test.use({ kind })
    test('adopts its own sandboxed document and effective presentation', async ({ desktop }) => {
      const page = await desktop.firstWindow()
      await expect
        .poll(() =>
          desktop.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows().some((w) => w.isVisible()),
          ),
        )
        .toBe(true)
      expect(new URL(page.url()).pathname).toBe('/' + kind + '/index.html')
      expect(
        await page.evaluate(() => ({
          scale: document.documentElement.style.getPropertyValue('--interface-scale'),
          language: document.documentElement.lang,
          node: typeof (globalThis as { process?: unknown }).process,
        })),
      ).toEqual({ scale: '100', language: 'en', node: 'undefined' })
      const renderer = await desktop.evaluate(({ app, BrowserWindow }) => {
        const pid = BrowserWindow.getAllWindows()[0]!.webContents.getOSProcessId()
        return { pid, sandboxed: app.getAppMetrics().find((item) => item.pid === pid)?.sandboxed }
      })
      if (process.platform === 'linux') {
        const status = await readFile('/proc/' + renderer.pid + '/status', 'utf8')
        expect(status).toMatch(/^Seccomp:\s+2$/m)
        expect(status).toMatch(/^NoNewPrivs:\s+1$/m)
      } else {
        expect(renderer.sandboxed).toBe(true)
      }
    })
  })
}

test('fixed tools open above the current page and a saved preference survives a document reload', async ({
  desktop,
}) => {
  const page = await desktop.firstWindow()
  const tasks = page.getByRole('button', { name: 'Task center', exact: true })
  await tasks.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('tab', { name: 'Active (0)' })).toBeVisible()
  await dialog.getByRole('tab', { name: 'Finished (0)' }).click()
  await expect(dialog.getByText('No finished tasks')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tasks).toBeFocused()

  await page.getByRole('button', { name: 'Application menu' }).click()
  await page.getByRole('menuitem', { name: 'Preferences', exact: true }).click()
  await dialog.getByRole('button', { name: 'Appearance', exact: true }).click()
  await dialog.getByRole('spinbutton', { name: 'Interface scale (%)' }).fill('120')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.style.getPropertyValue('--interface-scale')),
    )
    .toBe('120')
  await page.reload()
  await expect(tasks).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.style.getPropertyValue('--interface-scale')),
    )
    .toBe('120')
})

test('a dropped font previews before save and can be selected after reopening the library', async ({
  desktop,
}) => {
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Application menu' }).click()
  await page.getByRole('menuitem', { name: 'Font library' }).click()
  const dialog = page.getByRole('dialog')
  const bytes = await readFile(
    join(
      appRoot,
      'out/resources',
      hostTarget(),
      'fonts/noto-sans-mono/files/noto-sans-mono-latin-wght-normal.woff2',
    ),
  )
  await dialog.getByRole('button', { name: 'Import font' }).evaluate((button, input) => {
    const data = new DataTransfer()
    const bytes = Uint8Array.from(atob(input), (c) => c.charCodeAt(0))
    data.items.add(new File([bytes], 'sample.woff2', { type: 'font/woff2' }))
    button.dispatchEvent(
      new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
    )
  }, bytes.toString('base64'))
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue(/Noto Sans Mono/)
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.fonts].some(
          (face) => face.family.startsWith('Kisaki-preview-') && face.status === 'loaded',
        ),
      ),
    )
    .toBe(true)
  await dialog.getByLabel('Name', { exact: true }).fill('Isolated sample')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog.getByText('Isolated sample', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Application menu' }).click()
  await page.getByRole('menuitem', { name: 'Font library' }).click()
  await expect(dialog.getByText('Isolated sample', { exact: true })).toBeVisible()
})

test('saving and selecting a theme preserves the independent preference draft and its return focus', async ({
  desktop,
}) => {
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Application menu' }).click()
  await page.getByRole('menuitem', { name: 'Preferences', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Preferences', exact: true })
  await editor.getByRole('button', { name: 'Appearance', exact: true }).click()
  const scale = editor.getByRole('spinbutton', { name: 'Interface scale (%)' })
  await scale.fill('115')
  await editor.getByRole('button', { name: 'Manage themes' }).click()
  const themes = page.getByRole('dialog', { name: 'Themes', exact: true })
  await themes.getByRole('button', { name: 'New theme' }).click()
  await themes.getByLabel('Name', { exact: true }).fill('Sample theme')
  await themes.getByRole('button', { name: '--font-sans', exact: true }).click()
  // In this empty user library, the first option after the default comes from the OS catalog.
  await page.getByRole('listbox').getByRole('option').nth(1).click()
  await themes.getByRole('button', { name: 'Save and use' }).click()
  await expect(themes.getByText('Sample theme', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(scale).toHaveValue('115')
  await expect(editor.getByRole('button', { name: 'Manage themes' })).toBeFocused()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Keep editing' }).click()
  await expect(scale).toHaveValue('115')
  await editor.getByRole('button', { name: 'Discard changes' }).click()
  await expect(scale).toHaveValue('100')
  await expect(
    editor.getByRole('combobox', { name: 'Theme', exact: true }).locator('option:checked'),
  ).toHaveText('Sample theme')
  await page.keyboard.press('Escape')
  await expect(editor).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Application menu' })).toBeFocused()
})
