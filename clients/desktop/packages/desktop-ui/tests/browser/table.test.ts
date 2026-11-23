/** @fileoverview Checks the real body viewport and semantic column alignment of a scrollable table. */

import { chromium, expect } from '@playwright/test'
import { test as workshop } from './page'

/** Runs the table check with the classic scrollbar visible in the body viewport. */
const test = workshop.extend('browser', { scope: 'file' }, async ({}, { onCleanup }) => {
  const browser = await chromium.launch({
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: ['--disable-features=OverlayScrollbar,FluentOverlayScrollbar'],
  })
  onCleanup(() => browser.close())
  return browser
})

test('the body scrolls beneath a fixed header with shared columns and native table roles', async ({
  page,
}) => {
  const table = page.getByRole('table', { name: 'Scrollable sample table' })
  const header = table.locator('thead')
  const body = table.locator('tbody')
  const first = table.getByRole('rowheader', { name: 'First sample' })
  const last = table.getByRole('rowheader', { name: 'Last sample' })
  const sort = table.getByRole('columnheader', { name: 'Sort by status' }).getByRole('button')

  await expect(page.getByRole('table', { name: 'Synthetic rows' })).toBeVisible()
  await expect(table.getByRole('row')).toHaveCount(3)
  await expect(first).toBeVisible()
  await expect(last).not.toBeInViewport()

  await table.scrollIntoViewIfNeeded()
  const headerTop = (await header.boundingBox())!.y
  const bodyTop = (await body.boundingBox())!.y
  expect(bodyTop).toBeCloseTo(headerTop + (await header.boundingBox())!.height)
  expect(
    await body.evaluate((element) => element.getBoundingClientRect().width - element.clientWidth),
  ).toBeGreaterThan(1)

  await body.press('End')
  await expect(body).toBeFocused()
  await expect(last).toBeInViewport()
  expect((await header.boundingBox())!.y).toBe(headerTop)

  await sort.focus()
  await expect(sort).toBeInViewport()
  await expect.poll(() => body.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)

  for (const fontSize of [12, 16, 32]) {
    await page.evaluate((size) => (document.documentElement.style.fontSize = `${size}px`), fontSize)
    await body.evaluate((element) => (element.scrollLeft = element.scrollWidth))
    await expect
      .poll(() =>
        table.evaluate((element) => {
          const heading = element.querySelector('thead th:last-child')!
          const cell = element.querySelector('tbody tr:last-child td')!
          return Math.abs(
            heading.getBoundingClientRect().right - cell.getBoundingClientRect().right,
          )
        }),
      )
      .toBeLessThan(0.5)
  }
})
