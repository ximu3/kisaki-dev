/** @fileoverview Exercises logical selection, editable queries and virtual navigation in Chromium. */

import { expect } from 'vite-plus/test'
import { expect as browserExpect } from '@playwright/test'
import { test } from './page'
import type {} from '../fixtures/workshop/api'

test('virtual selection keeps offscreen values while keyboard navigation mounts the active option', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const trigger = page.getByRole('combobox', { name: 'Virtual choices' })
  await trigger.click()
  const selected = page.getByRole('option', { name: 'Item 9000', exact: true })
  await browserExpect(selected).toHaveAttribute('aria-selected', 'true')
  await browserExpect(selected).toBeInViewport({ ratio: 0.99 })
  expect(await page.getByRole('option').count()).toBeLessThan(40)
  await trigger.press('End')
  const last = page.getByRole('option', { name: 'Item 10000', exact: true })
  await browserExpect(last.getByText('Item 10000', { exact: true })).toBeInViewport({ ratio: 1 })
  await browserExpect(last).toHaveAttribute('aria-posinset', '10000')
  const list = page.locator('#virtual-form [role="listbox"]')
  expect(await list.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
  await browserExpect(trigger).toHaveAttribute(
    'aria-activedescendant',
    (await last.getAttribute('id'))!,
  )
  await trigger.press('Space')
  const closing = await list.evaluate((viewport) => {
    const panel = viewport.closest<HTMLElement>('[popover]')!
    const before = [viewport.clientHeight, viewport.scrollTop, viewport.childElementCount]
    panel.hidePopover()
    return {
      before,
      after: [viewport.clientHeight, viewport.scrollTop, viewport.childElementCount],
      open: panel.matches(':popover-open'),
    }
  })
  expect(closing.open).toBe(false)
  expect(closing.after).toEqual(closing.before)
  await browserExpect(list).toBeHidden()
  expect(
    await page
      .locator('#virtual-form')
      .evaluate((node: HTMLFormElement) => new FormData(node).getAll('virtual')),
  ).toEqual(['8999', '9999'])

  await page.locator('#virtual-form').evaluate((form) => {
    form.style.width = '8rem'
  })
  const form = page.locator('#virtual-form')
  await browserExpect(form.getByRole('button', { name: 'Previous selected items' })).toBeHidden()
  /**
   * Dispatches a backward wheel sample over a selected chip and reports whether it remained
   * uncancelled.
   */
  const wheelPrevious = () =>
    form
      .getByRole('button', { name: 'Remove Item 9000' })
      .evaluate((button) =>
        button.dispatchEvent(
          new WheelEvent('wheel', { deltaY: -80, bubbles: true, cancelable: true }),
        ),
      )
  expect(await wheelPrevious()).toBe(false)
  const forward = form.getByRole('button', { name: 'Next selected items' })
  const backward = form.getByRole('button', { name: 'Previous selected items' })
  const firstChip = form.getByRole('button', { name: 'Remove Item 9000' })
  const endBeforeScroll = (await forward.boundingBox())!.x - (await firstChip.boundingBox())!.x
  await forward.click()
  await browserExpect(backward).toBeEnabled()
  const edge = (await backward.boundingBox())!
  const startAfterScroll = edge.x + edge.width - (await firstChip.boundingBox())!.x
  expect(startAfterScroll).toBeLessThanOrEqual(endBeforeScroll + 1)
  await form.getByRole('button', { name: 'Remove Item 10000' }).click()
  await form.evaluate((form) => form.style.removeProperty('width'))
  await browserExpect(form.getByRole('button', { name: 'Previous selected items' })).toBeHidden()
  expect(await wheelPrevious()).toBe(true)
})

test('searchable fields edit a popup query and submit committed selections across result changes', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Open dialog', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit sample' })
  const candidate = page.getByRole('button', { name: 'Candidate', exact: true })
  const search = page.getByRole('combobox', { name: 'Search candidates' })

  await page.locator('#candidate-label').click()
  await browserExpect(candidate).not.toBeFocused()
  await browserExpect(candidate).toHaveAttribute('aria-expanded', 'false')
  await candidate.press('ArrowDown')
  await browserExpect(search).toBeFocused()
  await search.press('ArrowDown')
  await search.press('Enter')
  await browserExpect(candidate).toHaveText('Beta')
  await browserExpect(candidate).toBeFocused()

  await candidate.click()
  await candidate.click()
  await browserExpect(candidate).toHaveAttribute('aria-expanded', 'false')
  await candidate.press('ArrowDown')
  await candidate.evaluate((node) => {
    node.closest('fieldset')!.disabled = true
  })
  await browserExpect(dialog.getByRole('listbox')).toHaveCount(0)
  await browserExpect(candidate).toBeDisabled()
  await candidate.evaluate((node) => {
    node.closest('fieldset')!.disabled = false
  })

  const related = page.getByRole('button', { name: 'Related choices', exact: true })
  const query = page.getByRole('combobox', { name: 'Search related choices' })
  await related.click()
  await query.fill('Bet')
  await query.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
  await browserExpect(related).toHaveText('Alpha')
  await query.press('Enter')
  await browserExpect(query).toHaveValue('Bet')
  await page.evaluate(() => window.fixture.setOptions())
  await query.fill('Zeta')
  await page.getByRole('option', { name: 'Zeta' }).click()
  await query.press('Escape')
  await browserExpect(related).toBeFocused()
  const form = page.locator('#candidate-form')
  expect(await form.evaluate((node: HTMLFormElement) => [...new FormData(node)])).toEqual([
    ['candidate', 'b'],
    ['related', 'a'],
    ['related', 'b'],
    ['related', 'z'],
  ])
  await form.evaluate((node: HTMLFormElement) => node.reset())
  await browserExpect(related).toHaveText('Alpha')
  await browserExpect(candidate).toHaveText('Alpha')
})
