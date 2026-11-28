import { copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appRoot } from '../../../../../tools/lib/paths'
import { expect, test } from '../../../../support/electron'

test('reads an anime file’s actual tracks and chapters in the details dialog and keeps a draft episode number across a kind switch', async ({
  desktop,
  profile,
}) => {
  const path = join(profile, 'Winter - 01.mkv')
  await copyFile(join(appRoot, 'tests', 'fixtures', 'media', 'two-chapters.mkv'), path)
  await desktop.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
  }, path)
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Add entry', exact: true }).click()
  const entry = page.getByRole('dialog', { name: 'Add entry', exact: true })
  await entry.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Anime', exact: true }).click()
  await entry.getByRole('textbox', { name: 'Name', exact: true }).fill('Winter')
  await entry.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('tab', { name: 'Episodes and extras', exact: true }).click()
  await page.getByRole('button', { name: 'Create', exact: true }).first().click()
  const part = page.getByRole('dialog', { name: 'Episode', exact: true })
  await part.getByRole('textbox', { name: 'Name', exact: true }).fill('Arrival')
  await part.getByRole('textbox', { name: 'Number', exact: true }).fill('01')
  const kind = part.getByRole('combobox', { name: 'Part kind', exact: true })
  await kind.click()
  await page.getByRole('option', { name: 'Extra', exact: true }).click()
  const extra = page.getByRole('dialog', { name: 'Extra', exact: true })
  await expect(extra.getByRole('textbox', { name: 'Number', exact: true })).toHaveCount(0)
  await extra.getByRole('combobox', { name: 'Part kind', exact: true }).click()
  await page.getByRole('option', { name: 'Episode', exact: true }).click()
  await expect(part.getByRole('textbox', { name: 'Number', exact: true })).toHaveValue('01')
  await part.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('tab', { name: 'Files', exact: true }).click()
  await page.getByRole('button', { name: 'Add file', exact: true }).click()
  await page.getByRole('button', { name: 'More · ' + path, exact: true }).click()
  await page.getByRole('menuitem', { name: 'File details', exact: true }).click()
  const file = page.getByRole('dialog', { name: 'File details', exact: true })
  await file.getByRole('button', { name: 'Media information', exact: true }).click()
  await expect(file.getByText(/160 × 90/u)).toBeVisible()
  await expect(file.getByText(/ffv1/iu)).toBeVisible()
  await expect(file.getByText(/pcm/iu)).toBeVisible()
  await expect(file.getByRole('heading', { name: 'Chapters', exact: true })).toBeVisible()
  await expect(file.getByText(/^0\.5\s*·/u)).toBeVisible()
})
