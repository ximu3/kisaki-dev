import { expect, test } from '../../../support/electron'

test('records a session from the work detail and saves an independent note with a link back to the work', async ({
  desktop,
}) => {
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Add entry', exact: true }).click()
  const create = page.getByRole('dialog', { name: 'Add entry' })
  await create.getByRole('textbox', { name: 'Name', exact: true }).fill('Paper garden')
  await create.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('tab', { name: 'Activity', exact: true }).click()
  await page.getByRole('button', { name: 'Add activity' }).click()
  const activity = page.getByRole('dialog', { name: 'Add activity' })
  await activity.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(activity).toHaveCount(0)
  await expect(page.getByRole('tabpanel', { name: 'Activity' }).getByText(/60 min/u)).toBeVisible()
  await page.getByRole('tab', { name: 'Notes', exact: true }).click()
  await page.getByRole('button', { name: 'Add note' }).click()
  const note = page.getByRole('dialog', { name: 'Add note' })
  await note.getByRole('textbox', { name: 'Title', exact: true }).fill('After the ending')
  await note.getByRole('button', { name: 'Save', exact: true }).click()
  await page
    .getByRole('button', { name: /After the ending/u })
    .first()
    .click()
  await expect(
    page
      .getByRole('dialog', { name: 'After the ending' })
      .getByRole('button', { name: 'Paper garden' }),
  ).toBeVisible()
})
