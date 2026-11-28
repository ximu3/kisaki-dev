import { test, expect } from '../../support/electron'

test('edits the original name in place, records a completion from the status menu and opens the work from a saved showcase', async ({
  desktop,
}) => {
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Add entry', exact: true }).click()
  const create = page.getByRole('dialog', { name: 'Add entry', exact: true })
  await create.getByRole('textbox', { name: 'Name', exact: true }).fill('Winter coast')
  await create.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: 'Edit Original name', exact: true }).click()
  const rename = page.getByRole('dialog', { name: 'Original name', exact: true })
  await rename.getByRole('textbox', { name: 'Original name', exact: true }).fill('冬の海')
  await rename.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('冬の海', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Set status', exact: true }).first().click()
  await page.getByRole('menuitem', { name: 'Record completion…' }).click()
  const completion = page.getByRole('dialog', { name: 'Record completion…' })
  await completion
    .getByRole('textbox', { name: 'Note', exact: true })
    .fill('Reached the final chapter')
  await completion.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Set status', exact: true }).first()).toHaveText(
    'Completed once',
  )

  await page.getByRole('button', { name: 'Showcase', exact: true }).click()
  await page.getByRole('button', { name: 'Add the first section' }).click()
  const manager = page.getByRole('dialog', { name: 'Manage sections' })
  await manager.getByRole('button', { name: 'Choose presets' }).click()
  const presets = page.getByRole('dialog', { name: 'Choose presets' })
  await presets.getByRole('checkbox', { name: 'Recently added', exact: true }).click()
  await presets.getByRole('button', { name: 'Create', exact: true }).click()
  await manager.getByRole('button', { name: 'Close', exact: true }).last().click()
  await page.reload()

  await page.getByRole('button', { name: 'Winter coast · Game', exact: true }).click()
  await expect(page.getByText('冬の海', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Set status', exact: true }).first().click()
  await page.getByRole('menuitem', { name: 'Completion history…' }).click()
  await expect(
    page
      .getByRole('dialog', { name: 'Completion history…' })
      .getByText('Reached the final chapter'),
  ).toBeVisible()
})
