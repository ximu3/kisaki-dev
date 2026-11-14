/** @fileoverview Exercises native forms, controlled editing and field feedback in Chromium. */

import { expect } from 'vite-plus/test'
import { expect as browserExpect } from '@playwright/test'
import { test } from './page'
import type {} from '../fixtures/workshop/api'

test('native controls submit, reset, cancel reset, follow external values and honor disabled fieldsets', async ({
  page,
}) => {
  await page.locator('#query').fill('changed')
  await page.locator('#notes').fill('new note')
  await page.getByLabel('Include', { exact: true }).uncheck()
  await page.getByLabel('Enabled', { exact: true }).uncheck()
  await page.getByLabel('Compact', { exact: true }).check()
  await page.locator('#select').click()
  await page.getByRole('option', { name: 'Beta', exact: true }).click()
  await page.getByRole('button', { name: 'Remove Amber' }).click()
  await browserExpect(page.getByRole('button', { name: 'Remove Coral' })).toBeFocused()
  await page.locator('#multi').click()
  await page.getByRole('option', { name: 'Coral', exact: true }).click()
  await page.getByRole('option', { name: 'Blue', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.getByLabel('Grid', { exact: true }).check()
  await page.locator('#level').focus()
  await page.keyboard.press('End')

  await page.evaluate(() => window.fixture.setExternal('remote'))
  await browserExpect(page.locator('#external')).toHaveValue('remote')

  await page.getByRole('button', { name: 'Submit controls' }).click()
  expect(await page.locator('body').getAttribute('data-submitted')).toBe(
    JSON.stringify([
      ['query', 'changed'],
      ['notes', 'new note'],
      ['density', 'compact'],
      ['choice', 'beta'],
      ['multi', 'b'],
      ['level', '100'],
      ['view', 'grid'],
      ['external', 'remote'],
    ]),
  )

  await page.getByLabel('Cancel resets').check()
  await page.getByRole('button', { name: 'Reset controls' }).click()
  await browserExpect(page.locator('#query')).toHaveValue('changed')

  await page.getByLabel('Cancel resets').uncheck()
  await page.getByRole('button', { name: 'Reset controls' }).click()
  await browserExpect(page.locator('#query')).toHaveValue('seed')
  await browserExpect(page.locator('#external')).toHaveValue('original')
  await browserExpect(page.getByLabel('Comfortable', { exact: true })).toBeChecked()
  await browserExpect(page.getByLabel('List', { exact: true })).toBeChecked()
  await browserExpect(page.locator('select[name="multi"]')).toHaveValues(['a', 'c'])

  await page.locator('#select').click()
  await page.getByRole('option', { name: 'Choose', exact: true }).click()
  expect(
    await page
      .locator('select[name="choice"]')
      .evaluate((node: HTMLSelectElement) => node.validity.valueMissing),
  ).toBe(true)

  await page.getByRole('button', { name: 'Submit controls' }).click()
  await browserExpect(page.locator('#select')).toBeFocused()

  await page.getByRole('button', { name: 'Toggle fieldset' }).click()
  await browserExpect(page.locator('#query')).toBeDisabled()
  await page.getByRole('button', { name: 'Submit controls' }).click()
  expect(await page.locator('body').getAttribute('data-submitted')).toBe(
    JSON.stringify([['external', 'original']]),
  )
})

test('numeric stepping, calendar selection and alpha editing retain valid form values and reset', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: 'Increase', exact: true }).click()
  await browserExpect(page.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue('3')

  const date = page.getByLabel('Calendar date', { exact: true })
  const editor = await date.boundingBox()
  const action = await page.getByRole('button', { name: 'Choose date', exact: true }).boundingBox()
  expect(action!.x).toBeCloseTo(editor!.x + editor!.width, 1)
  expect(action!.height).toBeCloseTo(editor!.height, 1)
  await date.focus()
  await date.press('Backspace')
  expect(await date.evaluate((node: HTMLInputElement) => node.validity.badInput)).toBe(true)
  const source = page.locator('#query')
  await source.fill('2024-02-28')
  await source.press('ControlOrMeta+A')
  await source.press('ControlOrMeta+C')
  await date.press('ControlOrMeta+V')
  await browserExpect(date).toHaveValue('2024-02-28')
  await page.getByRole('button', { name: 'Choose date', exact: true }).click()
  const day = page.getByRole('gridcell', { name: 'Wednesday, February 28, 2024', exact: true })
  await browserExpect(day).toBeFocused()
  const month = page.getByRole('combobox', { name: 'Month', exact: true })
  await month.click()
  await page.getByRole('option', { name: 'March', exact: true }).click()
  await browserExpect(page.getByRole('grid', { name: 'March 2024' })).toBeVisible()
  await browserExpect(date).toHaveValue('2024-02-28')
  await month.click()
  await page.getByRole('option', { name: 'February', exact: true }).click()
  const outgoing = await day.evaluateHandle((node) => {
    const panel = node.closest<HTMLElement>('[popover]')!
    panel.style.setProperty('--kui-anchor-exit', '3s')
    return panel
  })
  await day.press('ArrowRight')
  await page.keyboard.press('Enter')
  await browserExpect(date).toHaveValue('2024-02-29')
  await browserExpect(date).toBeFocused()
  expect(
    await outgoing.evaluate((panel) =>
      panel.querySelector('[role=gridcell][aria-selected=true]')?.getAttribute('data-date'),
    ),
  ).toBe('2024-02-28')
  await outgoing.dispose()
  await page.getByRole('button', { name: 'Choose date', exact: true }).click()
  await page
    .getByRole('gridcell', { name: 'Thursday, February 29, 2024', exact: true })
    .press('ArrowRight')
  await browserExpect(
    page.getByRole('gridcell', { name: 'Friday, March 1, 2024', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Escape')

  const color = page.getByRole('textbox', { name: 'Color value' })
  await color.fill('invalid-color')
  expect(await color.evaluate((node: HTMLInputElement) => node.validity.valid)).toBe(false)
  await color.fill('rgb(51 102 153)')
  await page.getByRole('button', { name: 'Choose color', exact: true }).click()
  await page.getByRole('slider', { name: 'Alpha', exact: true }).fill('50')
  await page.keyboard.press('Escape')
  await browserExpect(color).toHaveValue('#33669980')

  expect(
    await page
      .locator('#special-fields')
      .evaluate((node: HTMLFormElement) => [...new FormData(node)]),
  ).toEqual([
    ['quantity', '3'],
    ['date', '2024-02-29'],
    ['color', '#33669980'],
  ])
  await page.getByRole('spinbutton', { name: 'Quantity' }).fill('5')
  await browserExpect(page.getByRole('button', { name: 'Increase', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Reset special fields' }).click()
  await browserExpect(page.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue('2')
  await browserExpect(page.getByRole('button', { name: 'Increase', exact: true })).toBeEnabled()
  await browserExpect(date).toHaveValue('2024-02-28')
  await browserExpect(color).toHaveValue('#336699')
})

test('IME defers controlled writes and native editing retains undo', async ({ page }) => {
  const input = page.locator('#external')
  await input.focus()
  await input.dispatchEvent('compositionstart')
  await page.evaluate(() => window.fixture.setExternal('during composition'))
  await browserExpect(input).toHaveValue('original')
  await input.dispatchEvent('compositionend')
  await browserExpect(input).toHaveValue('during composition')

  await page.locator('#query').focus()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('edited')
  await page.keyboard.press('ControlOrMeta+Z')
  await browserExpect(page.locator('#query')).toHaveValue('seed')
})

test('form feedback retains geometry and per-field errors while revealing and locating hidden fields', async ({
  page,
}) => {
  expect(await page.locator('#title').getAttribute('aria-invalid')).toBeNull()
  const before = await page.locator('#feedback').boundingBox()
  await page.getByRole('button', { name: 'Save sample' }).click()
  await browserExpect(page.locator('#title')).toBeFocused()
  await browserExpect(page.locator('#title')).toHaveAttribute('aria-invalid', 'true')
  const described = await page.locator('#title').getAttribute('aria-describedby')
  expect(described).toContain('title-error')
  const prompt = page.locator('#feedback button')
  const detail = page.locator('#feedback [role="tooltip"]')
  await browserExpect(prompt).toHaveAccessibleName('Enter a title.')
  await browserExpect(detail).toHaveCount(0)

  for (const language of ['English', '简体中文', '繁體中文', '日本語']) {
    await page.evaluate((language) => window.fixture.setLongMessage(language), language)
    expect((await page.locator('#feedback').boundingBox())?.height).toBe(before?.height)
  }

  await prompt.hover()
  await browserExpect(detail).toBeVisible()
  await browserExpect(detail).toHaveText((await page.locator('#title-error').textContent())!)
  await prompt.focus()
  await browserExpect(prompt).toHaveAccessibleName('Enter a title.')
  await page.keyboard.press('Escape')
  await browserExpect(detail).toBeHidden()

  await page.getByRole('tab', { name: 'Detail', exact: true }).click()
  await page.locator('#description').focus()
  await browserExpect(prompt).toHaveText('Enter a description.')
  await browserExpect(detail).toHaveCount(0)
  await page.getByRole('button', { name: 'Save sample' }).focus()
  await browserExpect(prompt).toHaveText('2 fields need attention')
  await prompt.click()
  await browserExpect(page.locator('#title')).toBeFocused()

  await page.locator('#title').fill('Complete')
  await browserExpect(page.locator('#title')).toBeFocused()
  await browserExpect(prompt).toHaveText('1 field needs attention')
  await browserExpect(detail).toHaveCount(0)
  await prompt.click()
  await browserExpect(page.locator('#description')).toBeFocused()

  await page.locator('#feedback').evaluate((element) => {
    element.style.maxWidth = '4ch'
  })
  await prompt.hover()
  await browserExpect(detail).toHaveText('Enter a description.')
  await browserExpect(detail).toBeVisible()
  await page.locator('#feedback').evaluate((element) => element.style.removeProperty('max-width'))
  await browserExpect(detail).toHaveCount(0)
  await page.locator('#description').fill('A useful description')
  await browserExpect(page.locator('#feedback')).toHaveText('')
  expect((await page.locator('#feedback').boundingBox())?.height).toBe(before?.height)
})
