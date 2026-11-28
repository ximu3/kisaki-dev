import { join } from 'node:path'
import { appRoot } from '../../../../tools/lib/paths'
import { expect, test } from '../../../support/electron'

test('a cropped cover is adopted at save and can be read after the document reloads', async ({
  desktop,
}) => {
  const image = join(appRoot, 'assets', 'icons', 'source.png')
  await desktop.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
  }, image)
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Add entry', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Add entry', exact: true })
  await form.getByRole('textbox', { name: 'Name', exact: true }).fill('Illustrated garden')
  await form.getByRole('button', { name: 'Choose image', exact: true }).first().click()
  const crop = page.getByRole('dialog', { name: 'Crop image' })
  await crop.getByRole('spinbutton', { name: 'Width', exact: true }).fill('48')
  await crop.getByRole('spinbutton', { name: 'Height', exact: true }).fill('64')
  await crop.getByRole('button', { name: 'Use', exact: true }).click()
  await expect(crop).toHaveCount(0)
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(form).toHaveCount(0)
  const cover = page.getByRole('img', { name: 'Illustrated garden', exact: true })
  async function check() {
    await expect
      .poll(() => cover.evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight]))
      .toEqual([48, 64])
  }
  await check()
  await page.reload()
  await page.getByRole('button', { name: 'Illustrated garden', exact: true }).click()
  await check()
})
