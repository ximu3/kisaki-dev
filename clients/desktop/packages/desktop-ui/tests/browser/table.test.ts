import { chromium, expect } from '@playwright/test'
import { test as workshop } from './page'

/** Runs the table check with classic scrollbars. */
const test = workshop.extend('browser', { scope: 'file' }, async ({}, { onCleanup }) => {
  const browser = await chromium.launch({
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: ['--disable-features=OverlayScrollbar,FluentOverlayScrollbar'],
  })
  onCleanup(() => browser.close())
  return browser
})

test('one viewport scrolls beneath a sticky header with shared columns and native table roles', async ({
  page,
}) => {
  const table = page.getByRole('table', { name: 'Scrollable sample table' })
  const header = table.locator('thead')
  const viewport = table.locator('..')
  const first = table.getByRole('rowheader', { name: 'First sample' })
  const last = table.getByRole('rowheader', { name: 'Last sample' })
  const sort = table.getByRole('columnheader', { name: 'Sort by status' }).getByRole('button')

  await expect(page.getByRole('table', { name: 'Synthetic rows' })).toBeVisible()
  await expect(table.getByRole('row')).toHaveCount(3)
  await expect(first).toBeVisible()
  await expect(last).not.toBeInViewport()

  await viewport.scrollIntoViewIfNeeded()
  const headerTop = (await header.boundingBox())!.y
  const bodyTop = (await table.locator('tbody').boundingBox())!.y
  expect(bodyTop).toBeCloseTo(headerTop + (await header.boundingBox())!.height)
  expect(
    await viewport.evaluate(
      (element) => element.getBoundingClientRect().width - element.clientWidth,
    ),
  ).toBeGreaterThan(1)

  await page.evaluate(() => window.fixture.scrollSampleToEnd(2))
  await expect
    .poll(() => viewport.evaluate((node) => node.scrollHeight - node.scrollTop - node.clientHeight))
    .toBeLessThan(1)
  await viewport.evaluate((node) => {
    node.style.zoom = '1.5'
  })
  await page.evaluate(() => window.fixture.scrollSampleToEnd(1))
  await expect
    .poll(() =>
      viewport.evaluate((node) => {
        const headerHeight = node.querySelector('thead')!.offsetHeight
        const middleEnd = 900 - (node.clientHeight - headerHeight)
        return Math.abs(node.scrollTop - middleEnd)
      }),
    )
    .toBeLessThan(1)
  await viewport.evaluate((node) => {
    node.style.removeProperty('zoom')
    node.scrollTop = 0
  })

  await viewport.press('End')
  await expect(viewport).toBeFocused()
  await expect(last).toBeInViewport()
  expect((await header.boundingBox())!.y).toBe(headerTop)

  await sort.focus()
  await expect(sort).toBeInViewport()
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)

  for (const fontSize of [12, 16, 32]) {
    await page.evaluate((size) => (document.documentElement.style.fontSize = `${size}px`), fontSize)
    await viewport.evaluate((element) => (element.scrollLeft = element.scrollWidth))
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

  await page.evaluate(() => window.fixture.setSampleTableDirection('rtl'))
  await expect
    .poll(async () =>
      viewport.evaluate((node) => {
        node.scrollLeft = 0
        const heading = node.querySelector('thead th:first-child')!
        return Math.abs(
          node.getBoundingClientRect().left +
            node.clientLeft +
            node.clientWidth -
            heading.getBoundingClientRect().right,
        )
      }),
    )
    .toBeLessThan(1)
})
