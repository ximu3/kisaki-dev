import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaults } from '@kisaki3/desktop-appearance/defaults'
import { initializeDatabase } from '../../../src/main/infrastructure/database'
import { themeStorage } from '../../../src/main/features/appearance/storage'
import { preferenceStorage } from '../../../src/main/features/preferences/storage'
import { expect, test } from '../../support/electron'
import { storageOptions } from '../database/sample'

test.use({
  profile: async ({}, use) => {
    const root = await mkdtemp(join(tmpdir(), 'kisaki-appearance-'))
    try {
      const storage = initializeDatabase(storageOptions(root))
      try {
        const theme = themeStorage(storage).createTheme({
          name: 'Unreadable theme',
          light: {
            ...defaults.light,
            '--background': '#fff',
            '--foreground': '#fff',
            '--font-sans': { type: 'system', family: 'Synthetic Kisaki Missing Family' },
            '--font-mono': { type: 'default' },
          },
          dark: {
            ...defaults.dark,
            '--font-sans': { type: 'default' },
            '--font-mono': { type: 'default' },
          },
        })
        preferenceStorage(storage).changePreferences(
          { appearance: { mode: 'light', theme, interfaceScale: 110 } },
          {},
          undefined,
        )
      } finally {
        storage.close()
      }
      await use(root)
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 4 })
    }
  },
})

test('the main window announces a missing font and the native menu restores the default theme', async ({
  desktop,
}) => {
  const page = await desktop.firstWindow()
  const readToken = (name: string) =>
    page.locator('html').evaluate((element, key) => element.style.getPropertyValue(key), name)

  await expect.poll(() => readToken('--foreground')).toBe('#fff')
  await expect.poll(() => readToken('--font-sans')).toBe(defaults.light['--font-sans'])
  await expect(
    page.getByText('Interface font is unavailable. Kisaki is using the default font.'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Application menu', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Themes', exact: true }).click()
  await page.getByRole('button', { name: 'Edit Unreadable theme', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Edit theme', exact: true })
  const name = editor.getByRole('textbox', { name: 'Name', exact: true })
  const preview = editor.getByRole('switch', { name: 'Preview', exact: true })
  await name.fill('Unsaved recovery draft')
  await editor.getByRole('textbox', { name: 'Foreground', exact: true }).fill('#abc')
  await preview.check()
  await expect.poll(() => readToken('--foreground')).toBe('#abc')

  await expect
    .poll(() =>
      desktop.evaluate(
        ({ Menu }) =>
          Menu.getApplicationMenu()?.items.some((menu) =>
            menu.submenu?.items.some((item) => item.label === 'Restore default theme'),
          ) ?? false,
      ),
    )
    .toBe(true)
  await desktop.evaluate(({ Menu }) => {
    const restore = Menu.getApplicationMenu()
      ?.items.flatMap((menu) => menu.submenu?.items ?? [])
      .find((item) => item.label === 'Restore default theme')
    if (!restore) {
      throw new Error('The native application menu has no theme recovery action')
    }
    const click = restore.click as (this: typeof restore) => void
    click.call(restore)
  })

  await expect.poll(() => readToken('--foreground')).toBe(defaults.light['--foreground'])
  await expect.poll(() => readToken('--interface-scale')).toBe('110')
  await expect(preview).not.toBeChecked()
  await expect(name).toHaveValue('Unsaved recovery draft')

  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
  await expect(editor).toBeHidden()
})
