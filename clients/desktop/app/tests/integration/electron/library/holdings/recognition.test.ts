import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '../../../../support/electron'

test('a registered book can be tested with a preset draft and then the independently saved directory profile', async ({
  desktop,
  profile,
}) => {
  const folder = join(profile, 'Books'),
    file = join(folder, '01.txt')
  await mkdir(folder)
  await writeFile(file, 'A winter story')
  await desktop.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] })
  }, folder)
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Add entry', exact: true }).click()
  const create = page.getByRole('dialog', { name: 'Add entry' })
  await create.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Novel', exact: true }).click()
  await create.getByRole('textbox', { name: 'Name', exact: true }).fill('Winter book')
  await create.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('tab', { name: 'Volumes', exact: true }).click()
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  const volume = page.getByRole('dialog', { name: 'Volume', exact: true })
  await volume.getByRole('textbox', { name: 'Number', exact: true }).fill('1')
  await volume.getByRole('button', { name: 'Save', exact: true }).click()

  await page.getByRole('button', { name: 'Manage directories', exact: true }).click()
  const directories = page.getByRole('dialog', { name: 'Manage directories' })
  await directories.getByRole('button', { name: 'Add directory' }).click()
  await directories.getByRole('button', { name: 'More · ' + folder }).click()
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
  const dir = page.getByRole('dialog', { name: 'Content directories', exact: true })
  await dir.getByRole('button', { name: 'Manage', exact: true }).click()
  const profiles = page.getByRole('dialog', { name: 'File recognition profiles' })
  await profiles.getByRole('button', { name: 'Choose presets' }).click()
  const picker = page.getByRole('dialog', { name: 'Choose presets' })
  await picker.getByRole('button', { name: 'Volume number', exact: true }).click()
  await picker.getByRole('button', { name: 'Confirm', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Recognition profile', exact: true })
  await editor.getByRole('button', { name: 'Test rules', exact: true }).click()
  await editor.getByRole('combobox').last().click()
  await page.getByRole('option', { name: file, exact: true }).click()
  await editor.getByRole('button', { name: 'Test recognition', exact: true }).click()
  await expect(editor.getByRole('status').filter({ hasText: 'Rule source' })).toContainText(
    'Draft rule',
  )
  await expect(editor.getByRole('status').filter({ hasText: 'Rule source' })).toContainText(
    'Matched parts',
  )
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
  await profiles.getByRole('button', { name: 'Close', exact: true }).last().click()
  await expect(dir.getByRole('combobox').first()).toContainText('Built-in rules')
  await dir.getByRole('combobox').first().click()
  await page.getByRole('option', { name: 'Volume number', exact: true }).click()
  await dir.getByRole('button', { name: 'Save', exact: true }).click()
  await directories.getByRole('button', { name: 'Close', exact: true }).last().click()
  await page.getByRole('tab', { name: 'Files', exact: true }).click()
  await page.getByRole('button', { name: 'More · ' + file, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Test recognition', exact: true }).click()
  await expect(page.getByRole('tabpanel', { name: 'Volumes' }).getByRole('status')).toContainText(
    'Recognition profile',
  )
  await expect(page.getByRole('tabpanel', { name: 'Volumes' }).getByRole('status')).toContainText(
    'Matched parts',
  )
})
