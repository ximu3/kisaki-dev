import { mkdir, symlink, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '../../support/electron'

test('automatic discovery follows filesystem changes and preference changes without following a child link', async ({
  desktop,
  profile,
}) => {
  const root = join(profile, 'volumes'),
    outside = join(profile, 'outside')
  await Promise.all([mkdir(root), mkdir(outside)])
  await writeFile(join(outside, 'private.txt'), 'Outside the content directory')
  await symlink(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
  await desktop.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] })
  }, root)
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Add entry', exact: true }).click()
  const entry = page.getByRole('dialog', { name: 'Add entry', exact: true })
  await entry.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Novel', exact: true }).click()
  await entry.getByRole('textbox', { name: 'Name', exact: true }).fill('Shelf with watched files')
  await entry.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('tab', { name: 'Volumes', exact: true }).click()
  await page.getByRole('button', { name: 'Manage directories', exact: true }).click()
  const manager = page.getByRole('dialog', { name: 'Manage directories' })
  await manager.getByRole('button', { name: 'Add directory' }).click()
  await expect(manager.getByText(root, { exact: true })).toBeVisible()
  await manager.getByRole('button', { name: 'Close', exact: true }).last().click()
  await page.getByRole('tab', { name: 'Files', exact: true }).click()
  const files = page.getByRole('tabpanel', { name: 'Files', exact: true })
  const first = join(root, 'Vol.01.txt'),
    second = join(root, 'Vol.02.txt')
  await writeFile(first, 'First volume')
  await expect(files.getByRole('checkbox', { name: first, exact: true })).toBeVisible()
  await expect(files.getByText('private.txt', { exact: true })).toHaveCount(0)
  async function toggle() {
    await page.getByRole('button', { name: 'Application menu' }).click()
    await page.getByRole('menuitem', { name: 'Preferences', exact: true }).click()
    const prefs = page.getByRole('dialog', { name: 'Preferences', exact: true })
    await prefs.getByRole('tab', { name: 'Library', exact: true }).click()
    await prefs.getByRole('switch', { name: 'Refresh local files automatically' }).click()
    await prefs.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(prefs.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(prefs).toHaveCount(0)
  }
  await toggle()
  await rename(first, second)
  await expect(files.getByRole('checkbox', { name: first, exact: true })).toBeVisible()
  await toggle()
  await expect(files.getByRole('checkbox', { name: second, exact: true })).toBeVisible()
  await expect(files.getByRole('button', { name: /Vol\.01\.txt.*Missing/u })).toBeVisible()
  await expect(files.getByRole('checkbox')).toHaveCount(2)
})
