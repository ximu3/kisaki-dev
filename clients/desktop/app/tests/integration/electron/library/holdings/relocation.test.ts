import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '../../../../support/electron'

test('directory manager keeps the old group on a root conflict and reports each mapping on retry', async ({
  desktop,
  profile,
}) => {
  const original = join(profile, 'A'),
    occupied = join(profile, 'B'),
    destination = join(profile, 'C')
  await Promise.all([mkdir(original), mkdir(occupied)])
  await Promise.all([
    writeFile(join(original, 'one.txt'), 'Original text'),
    writeFile(join(original, 'two.txt'), 'Second text'),
    writeFile(join(occupied, 'one.txt'), 'Another text'),
  ])
  await desktop.evaluate(
    ({ dialog }, choices) => {
      dialog.showOpenDialog = async () => {
        const path = choices.shift()
        if (!path) {
          throw new Error('Unexpected file chooser')
        }
        return { canceled: false, filePaths: [path] }
      }
    },
    [original, occupied, occupied, destination],
  )
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Add entry', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Add entry' })
  await form.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Novel', exact: true }).click()
  await form.getByRole('textbox', { name: 'Name', exact: true }).fill('Local novels')
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('tab', { name: 'Volumes', exact: true }).click()
  await page.getByRole('button', { name: 'Manage directories', exact: true }).click()
  const manager = page.getByRole('dialog', { name: 'Manage directories' })
  for (const folder of [original, occupied]) {
    await manager.getByRole('button', { name: 'Add directory' }).click()
    await expect(manager.getByText(folder, { exact: true })).toBeVisible()
  }
  await manager.getByRole('button', { name: 'More · ' + original, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Relocate directory' }).click()
  const relocate = page.getByRole('dialog', { name: 'Relocate directory' })
  await relocate.getByRole('button', { name: 'Choose location' }).click()
  await relocate.getByRole('button', { name: 'Relocate directory', exact: true }).click()
  await expect(relocate.getByRole('status')).toContainText('No location changes')
  await expect(relocate.getByRole('status')).toContainText('The new root is already registered')
  expect(await readFile(join(occupied, 'one.txt'), 'utf8')).toBe('Another text')

  await rename(original, destination)
  await rename(join(destination, 'two.txt'), join(profile, 'elsewhere.txt'))
  await relocate.getByRole('button', { name: occupied, exact: true }).click()
  await relocate.getByRole('button', { name: 'Relocate directory', exact: true }).click()
  await expect(relocate.getByRole('status')).toContainText(original + ' → ' + destination)
  await expect(relocate.getByRole('status')).toContainText(
    join(original, 'one.txt') + ' → ' + join(destination, 'one.txt'),
  )
  await expect(relocate.getByRole('status')).toContainText(join(destination, 'two.txt'))
  await relocate.getByRole('button', { name: 'Close', exact: true }).last().click()
  await expect(manager.getByText(destination, { exact: true })).toBeVisible()
  await expect(manager.getByText(original, { exact: true })).toHaveCount(0)
})
