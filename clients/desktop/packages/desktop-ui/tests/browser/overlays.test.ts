/** @fileoverview Exercises overlay motion, keyboard focus and notification lifetime in Chromium. */

import { expect } from 'vite-plus/test'
import { expect as browserExpect } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { test } from './page'
import type {} from '../fixtures/workshop/api'

/**
 * Checks that entry opacity changes while text geometry remains fixed between the transition
 * midpoint and rest.
 */
async function checkSurface(panel: Locator, textSelector: string): Promise<void> {
  const result = await panel.evaluate((node, selector) => {
    const range = document.createRange()
    range.selectNodeContents(node.querySelector(selector)!)
    /** Samples the selected text range's viewport position and dimensions in CSS pixels. */
    const geometry = () => {
      const { x, y, width, height } = range.getBoundingClientRect()
      return [x, y, width, height]
    }
    const animations = node
      .getAnimations({ subtree: true })
      .filter((a) => a instanceof CSSTransition)
    for (const animation of animations) {
      animation.pause()
      animation.currentTime = Number(animation.effect!.getTiming().duration) / 2
    }
    const mid = geometry()
    const opacity = Number(getComputedStyle(node).opacity)
    for (const animation of animations) {
      animation.finish()
    }
    return {
      mid,
      end: geometry(),
      opacity,
    }
  }, textSelector)
  expect(result.opacity).toBeGreaterThan(0)
  expect(result.opacity).toBeLessThan(1)
  expect(result.end[2]).toBeGreaterThan(0)
  expect(result.mid).toEqual(result.end)
}

test('surfaces fade in place and a chart follows its pointer without replaying entry', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--kui-anchor-enter', '3s')
    document.documentElement.style.setProperty('--kui-modal-enter', '3s')
    document.documentElement.style.setProperty('--kui-hint-enter', '3s')
  })
  await page.getByRole('button', { name: 'Open dialog', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit sample' })
  await checkSurface(dialog, 'h2')
  await page.getByRole('button', { name: 'Actions', exact: true }).click()
  await checkSurface(
    page.getByRole('menu', { name: 'Actions', exact: true }),
    'button[aria-haspopup=menu]',
  )
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Load resources', exact: true }).click()
  const plot = page.locator('[data-vis-xy-container] svg').first()
  await plot.scrollIntoViewIfNeeded()
  const box = (await plot.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2)
  const tip = page.locator('[data-kui-chart-open]')
  await browserExpect(tip).toBeVisible()
  await checkSurface(tip, 'dt')
  const prior = await tip.evaluate((node) => node.getBoundingClientRect().left)
  const visibility = await tip.evaluateHandle((node) => {
    const state = {
      changes: 0,
      observer: new MutationObserver((records) => {
        state.changes += records.length
      }),
    }
    state.observer.observe(node, { attributes: true, attributeFilter: ['data-kui-chart-open'] })
    return state
  })
  for (const fraction of [0.52, 0.63, 0.74, 0.85]) {
    await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2)
  }
  await browserExpect
    .poll(() => tip.evaluate((node) => node.getBoundingClientRect().left))
    .not.toBe(prior)
  expect(
    await visibility.evaluate((state) => {
      state.observer.disconnect()
      return state.changes
    }),
  ).toBe(0)
  await visibility.dispose()
  expect(
    await tip.evaluate((node) =>
      node
        .getAnimations({ subtree: true })
        .some((a) => a instanceof CSSTransition && a.transitionProperty === 'opacity'),
    ),
  ).toBe(false)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.mouse.move(0, 0)
  await browserExpect(page.locator('[data-kui-chart-tooltip]')).toBeHidden()
})

test('native dialogs and menus close one interaction at a time and return real focus', async ({
  page,
}) => {
  await page.locator('html').evaluate((root) => {
    root.setAttribute('lang', 'tr')
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: 'Open dialog', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit sample' })
  await browserExpect(dialog).toBeVisible()

  await page.getByRole('button', { name: 'Actions', exact: true }).click()
  await browserExpect(page.getByRole('menuitem', { name: 'First action' })).toBeFocused()
  const firstAction = page.getByRole('menuitem', { name: 'First action' })
  await firstAction.dispatchEvent('keydown', { key: 'ı', bubbles: true })
  await browserExpect(page.getByRole('menuitem', { name: 'Işık' })).toBeFocused()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Actions', exact: true }).click()
  await firstAction.dispatchEvent('keydown', { key: '𠮷', bubbles: true })
  await browserExpect(page.getByRole('menuitem', { name: '𠮷野' })).toBeFocused()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowDown')
  await browserExpect(page.getByRole('menuitemcheckbox')).toBeFocused()
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowRight')
  await browserExpect(page.getByRole('menuitem', { name: 'Nested action' })).toBeFocused()
  await page.keyboard.press('Escape')
  await browserExpect(page.getByRole('menuitem', { name: 'More', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await browserExpect(dialog).toBeVisible()

  await page.getByRole('button', { name: 'Actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'More', exact: true }).hover()
  await browserExpect(page.getByRole('menuitem', { name: 'Nested action' })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Nested action' }).hover()
  await page.getByRole('menuitem', { name: 'Nested action' }).click()
  await browserExpect(page.getByRole('menu', { name: 'Actions', exact: true })).toBeHidden()

  await page.getByRole('button', { name: 'Nested dialog' }).click()
  await page.getByRole('button', { name: 'Return', exact: true }).click()
  await browserExpect(page.getByRole('button', { name: 'Nested dialog' })).toBeFocused()

  await page.getByLabel('Block close').check()
  await page.getByRole('button', { name: 'Close editor' }).click()
  await browserExpect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await browserExpect(dialog).toBeVisible()

  await page.getByLabel('Block close').uncheck()
  const closing = await page
    .getByRole('button', { name: 'Close editor' })
    .evaluate((button: HTMLButtonElement) => {
      const panel = button.closest('dialog')!
      const height = panel.offsetHeight
      button.click()
      return { height, retained: panel.offsetHeight, modal: panel.matches(':modal') }
    })
  expect(closing.modal).toBe(false)
  expect(closing.retained).toBe(closing.height)
  await browserExpect(page.getByRole('button', { name: 'Open dialog', exact: true })).toBeFocused()

  await page.locator('#context-target').focus()
  await page.keyboard.press('Shift+F10')
  await browserExpect(page.getByRole('menuitem', { name: 'Context action' })).toBeFocused()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Information', exact: true }).focus()
  await browserExpect(page.getByRole('tooltip')).toBeVisible()
  await page.getByRole('tooltip').hover()
  await browserExpect(page.getByRole('tooltip')).toBeVisible()
  await page.keyboard.press('Escape')
  await browserExpect(page.getByRole('tooltip')).toBeHidden()
})

test('toast clocks pause, survive caller disposal and follow active modals until explicitly ended', async ({
  page,
}) => {
  await page.clock.install()
  const initialOverflow = await page.evaluate(() => {
    window.fixture.showLoading(false)
    const region = document.querySelector<HTMLElement>('[role="region"][popover]:popover-open')!
    return {
      x: region.scrollWidth - region.clientWidth,
      y: region.scrollHeight - region.clientHeight,
    }
  })
  expect(initialOverflow).toEqual({ x: 0, y: 0 })
  await page.clock.fastForward(10_000)
  await browserExpect(page.getByText('Preparing sample', { exact: true })).toBeVisible()

  await page.evaluate(() => window.fixture.updateToast())
  await page.getByText('Sample ready', { exact: true }).hover()
  await page.clock.fastForward(10_000)
  await browserExpect(page.getByText('Sample ready', { exact: true })).toBeVisible()

  await page.mouse.move(0, 0)
  await page.clock.fastForward(6_000)
  await browserExpect(page.getByText('Sample ready', { exact: true })).toHaveCount(0)

  await page.evaluate(() => {
    window.fixture.showLoading(true)
    window.fixture.updateToast()
    window.fixture.rootToast()
  })
  await page.clock.fastForward(10_000)
  await browserExpect(page.getByText('Sample ready', { exact: true })).toBeVisible()

  await page.evaluate(() => {
    window.fixture.setOwner(false)
    window.fixture.updateToast()
  })
  await browserExpect(page.getByText('Sample ready', { exact: true })).toBeVisible()
  await browserExpect(page.getByText('Window owner survives', { exact: true })).toBeVisible()
  await page.evaluate(() => window.fixture.dismissToast())
  await page.getByRole('button', { name: 'Open dialog', exact: true }).click()
  await page.evaluate(() => window.fixture.showLoading(false))
  await page.getByRole('button', { name: 'Inspect sample' }).click()
  await browserExpect(page.locator('body')).toHaveAttribute('data-action', 'inspected')
  await page.getByRole('button', { name: 'Nested dialog' }).click()
  await page.getByRole('button', { name: 'Inspect sample' }).click()
  await browserExpect(
    page.getByRole('alertdialog').getByRole('region', { name: 'Window notifications' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Return', exact: true }).click()
  await page.getByRole('button', { name: 'Close editor' }).click()
  await browserExpect(page.getByText('Preparing sample', { exact: true })).toBeVisible()
  await page.evaluate(() => window.fixture.updateToast())
  await browserExpect(page.getByText('Sample ready', { exact: true })).toBeVisible()
  await page.evaluate(() => {
    window.fixture.dismissToast()
    window.fixture.updateToast()
  })
  await browserExpect(page.getByText('Sample ready', { exact: true })).toHaveCount(0)
  await page.evaluate(() => window.fixture.dispose())
  await page.clock.fastForward(10_000)
  await browserExpect(page.getByRole('region', { name: 'Window notifications' })).toHaveCount(0)
})
