/** @fileoverview Real browser acceptance for packed controls, modal composition and resource lifetimes. */

import { expect } from 'vitest'
import { expect as browserExpect } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { runPnpm } from '@kisaki3/tooling/process'
import { consumerTest as test, lintConsumer, packageRoot } from '../support/consumer'
import type {} from '../fixtures/consumers/browser/api'

/** Text must occupy its final bounds even while the frame is visibly scaled. */
async function checkSurface(panel: Locator, textSelector: string): Promise<void> {
  const result = await panel.evaluate((node, selector) => {
    const range = document.createRange()
    range.selectNodeContents(node.querySelector(selector)!)
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
    const scale = Number(getComputedStyle(node, '::before').scale)
    for (const animation of animations) {
      animation.finish()
    }
    return {
      mid,
      end: geometry(),
      scale,
      fading: animations.some((animation) => animation.transitionProperty === 'opacity'),
    }
  }, textSelector)
  expect(result.scale).toBeGreaterThan(0.97)
  expect(result.scale).toBeLessThan(1)
  expect(result.fading).toBe(true)
  expect(result.end[2]).toBeGreaterThan(0)
  expect(result.mid).toEqual(result.end)
}

test('floating frames preserve text geometry and a chart follows its pointer without replaying entry', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--kui-anchor-enter', '3s')
    document.documentElement.style.setProperty('--kui-modal-enter', '3s')
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
        .some((a) => a instanceof CSSTransition && a.transitionProperty === 'scale'),
    ),
  ).toBe(false)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.mouse.move(0, 0)
  await browserExpect(page.locator('[data-kui-chart-tooltip]')).toBeHidden()
})

test('packed declarations pass complete Bundler and NodeNext checks and typed consumer lint', async ({
  consumerDirectory,
  signal,
}) => {
  await runPnpm(['typecheck'], { cwd: consumerDirectory, signal })
  await lintConsumer(consumerDirectory)
})

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
  await browserExpect(last).toBeInViewport({ ratio: 0.99 })
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

test('numeric stepping, calendar selection and alpha editing retain valid form values and reset', async ({
  page,
}) => {
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
  await day.press('ArrowRight')
  await page.keyboard.press('Enter')
  await browserExpect(date).toHaveValue('2024-02-29')
  await browserExpect(date).toBeFocused()
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

test('native dialogs and menus close one interaction at a time and return real focus', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: 'Open dialog', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit sample' })
  await browserExpect(dialog).toBeVisible()

  await page.getByRole('button', { name: 'Actions', exact: true }).click()
  await browserExpect(page.getByRole('menuitem', { name: 'First action' })).toBeFocused()
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
  })
  const stackDuration = await page.evaluate(async () => {
    const card = document.querySelector('[role="region"][popover] [data-type]')!
    window.fixture.rootToast()
    await Promise.resolve()
    const movement = card
      .getAnimations()
      .find(
        (animation) =>
          animation.effect instanceof KeyframeEffect &&
          animation.effect.getKeyframes().some((frame) => 'transform' in frame),
      )
    return movement?.effect?.getTiming().duration
  })
  expect(stackDuration).toBe(100)
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

test('Markdown, charts and drag load as complete capabilities and release their instances', async ({
  page,
  consumerDirectory,
}) => {
  const manifest = JSON.parse(
    await readFile(join(consumerDirectory, 'dist/.vite/manifest.json'), 'utf8'),
  ) as Record<string, { isEntry?: boolean; dynamicImports?: string[] }>
  expect(
    Object.values(manifest).find((entry) => entry.isEntry)?.dynamicImports?.length,
  ).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Load resources' }).click()
  await browserExpect(page.getByRole('textbox', { name: 'Markdown source' })).toBeVisible()

  const readOnly = page.getByRole('checkbox', { name: 'Read only', exact: true })
  const bold = page.getByRole('button', { name: 'Bold', exact: true })
  const toolbar = page.getByRole('toolbar', { name: 'Formatting' })
  const undo = toolbar.getByRole('button', { name: 'Undo', exact: true })
  const reference = toolbar.getByRole('button', { name: 'Insert reference' })
  await browserExpect(undo).toBeDisabled()
  await readOnly.check()
  await browserExpect(bold).toBeDisabled()
  await browserExpect(reference).toBeDisabled()
  await readOnly.uncheck()
  await browserExpect(bold).toBeEnabled()

  const first = page.locator('#preview-one')
  const second = page.locator('#preview-two')
  await browserExpect(first.locator('img')).toHaveCount(0)
  await browserExpect(first).toContainText('<img src=x onerror=alert(1)>')
  const ids = await first.locator('[id]').evaluateAll((nodes) => nodes.map((node) => node.id))
  const other = await second.locator('[id]').evaluateAll((nodes) => nodes.map((node) => node.id))
  expect(ids.every((id) => !other.includes(id))).toBe(true)
  await browserExpect(first.locator('input[type="checkbox"]').first()).toBeDisabled()
  await first.getByRole('link', { name: 'External', exact: true }).click()
  await browserExpect(page.locator('body')).toHaveAttribute('data-link', 'https://example.com/')

  await bold.focus()
  await page.keyboard.press('ArrowRight')
  await browserExpect(toolbar.getByRole('button', { name: 'Italic' })).toBeFocused()
  await page.keyboard.press('Tab')
  await browserExpect(page.getByRole('textbox', { name: 'Markdown source' })).toBeFocused()

  await page.evaluate(() => window.fixture.editorSelect?.())
  await bold.click()
  expect(await page.evaluate(() => window.fixture.editorText?.())).toContain('**Sample**')
  await undo.click()
  expect(await page.evaluate(() => window.fixture.editorText?.())).toMatch(/^# Sample/)
  await page.evaluate(() => window.fixture.editorSelect?.())
  await reference.click()
  await browserExpect(first).toContainText('Reference')
  await page.evaluate(() => window.fixture.setSourceOnly?.(true))
  await browserExpect(toolbar).toHaveCount(0)
  await page.evaluate(() => window.fixture.setSourceOnly?.(false))
  await undo.click()
  expect(await page.evaluate(() => window.fixture.editorText?.())).toMatch(/^# Sample/)
  await page.evaluate(() => window.fixture.editorSet?.('External replacement'))
  await browserExpect(first).toHaveText('External replacement')

  await browserExpect(page.locator('[data-vis-xy-container] svg')).toHaveCount(1)
  await page.getByRole('button', { name: 'Update chart' }).click()
  expect(Number(await page.locator('body').getAttribute('data-chart-width'))).toBeGreaterThan(0)
  await page
    .locator('.resource-grid')
    .screenshot({ path: join(packageRoot, 'test-results/consumers/capabilities.png') })

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--chart-1', 'rgb(1 50 100)')
    document.documentElement.style.setProperty('--chart-2', 'rgb(2 60 110)')
  })
  const fills = await page
    .locator('[data-vis-single-container] svg path')
    .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).fill))
  expect(fills).toContain('rgb(1, 50, 100)')
  expect(fills).toContain('rgb(2, 60, 110)')

  await page.getByRole('button', { name: 'Move sample' }).press('Alt+ArrowDown')
  await browserExpect(page.getByRole('status').filter({ hasText: 'Moved next' })).toHaveCount(1)
  await page.getByRole('button', { name: 'Move sample' }).dragTo(page.locator('#drop-target'))
  await browserExpect(page.locator('body')).toHaveAttribute('data-dropped', 'true')

  await page.getByRole('button', { name: 'Release resources' }).click()
  expect(await page.evaluate(() => window.fixture.editorReleased)).toBe(true)
  await browserExpect(page.locator('[data-vis-xy-container]')).toHaveCount(0)
  await page.evaluate(() => window.fixture.dispose())
  await browserExpect(page.locator('#app')).toBeEmpty()
})

test('real Tailwind and unlayered host CSS override component styles in either loading order', async ({
  page,
  consumerDirectory,
}) => {
  const buttonClass = await page.locator('#theme').getAttribute('class')
  await page.evaluate(() => window.fixture.dispose())
  await runPnpm(['exec', 'tailwindcss', '-i', 'tailwind.css', '-o', 'utilities.css'], {
    cwd: consumerDirectory,
  })
  const ui = await readFile(
    join(consumerDirectory, 'node_modules/@kisaki3/desktop-ui/dist/styles.css'),
    'utf8',
  )
  const utilities = await readFile(join(consumerDirectory, 'utilities.css'), 'utf8')

  for (const sheets of [
    [ui, utilities],
    [utilities, ui],
  ]) {
    await page.setContent(
      `<button data-variant="default" class="${buttonClass} bg-accent text-accent-foreground">Layered</button>`,
    )
    for (const content of sheets) {
      await page.addStyleTag({ content })
    }
    await page.locator('html').evaluate((node) => {
      node.style.setProperty('--primary', 'rgb(4 5 6)')
      node.style.setProperty('--accent', 'rgb(1 2 3)')
    })
    await browserExpect(page.locator('button')).toHaveCSS('background-color', 'rgb(1, 2, 3)')
    await page.addStyleTag({ content: 'button { background:rgb(7 8 9) }' })
    await browserExpect(page.locator('button')).toHaveCSS('background-color', 'rgb(7, 8, 9)')
  }
})

test('ordinary CSS, dark mode, viewport scale and focus states remain independently usable', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Switch theme' }).click()
  await browserExpect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark')
  expect(
    await page.locator('#theme').evaluate((node) => getComputedStyle(node).borderRadius),
  ).not.toBe('0px')
  await page.screenshot({
    path: join(packageRoot, 'test-results/consumers/dark.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Switch theme' }).click()

  await page.setViewportSize({ width: 480, height: 800 })
  await page.evaluate(() => document.documentElement.style.setProperty('--interface-scale', '150'))
  expect(await page.locator('html').evaluate((node) => node.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('button', { name: 'Save sample' }).click()
  await page.screenshot({
    path: join(packageRoot, 'test-results/consumers/narrow.png'),
    fullPage: true,
  })
})
