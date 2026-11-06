/** @fileoverview Real browser acceptance for packed controls, modal composition and resource lifetimes. */

import { expect } from 'vitest'
import { expect as browserExpect } from '@playwright/test'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { runPnpm } from '@kisaki3/tooling/process'
import { consumerTest as test, lintConsumer, packageRoot } from '../support/consumer'
import type {} from '../fixtures/consumers/browser/api'

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
  await page.locator('#select').selectOption('beta')
  await page.locator('#multi').selectOption(['b'])
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
  await browserExpect(page.locator('#multi')).toHaveValues(['a', 'c'])

  await page.locator('#select').selectOption('')
  expect(
    await page.locator('#select').evaluate((node: HTMLSelectElement) => node.validity.valueMissing),
  ).toBe(true)

  await page.getByRole('button', { name: 'Toggle fieldset' }).click()
  await browserExpect(page.locator('#query')).toBeDisabled()
  await page.getByRole('button', { name: 'Submit controls' }).click()
  expect(await page.locator('body').getAttribute('data-submitted')).toBe(
    JSON.stringify([['external', 'original']]),
  )
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

  for (const language of ['English', '简体中文', '繁體中文', '日本語']) {
    await page.evaluate((language) => window.fixture.setLongMessage(language), language)
    expect((await page.locator('#feedback').boundingBox())?.height).toBe(before?.height)
  }

  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await page.getByRole('button', { name: 'Description', exact: true }).click()
  await browserExpect(page.locator('#description')).toBeFocused()
  await page.locator('#description').fill('A useful description')
  await browserExpect(page.locator('#description')).toBeFocused()

  await page.getByRole('button', { name: 'Locate', exact: true }).click()
  await browserExpect(page.locator('#title')).toBeFocused()
  await page.locator('#title').fill('Complete')
  await browserExpect(page.locator('#feedback')).toHaveText('')
  expect((await page.locator('#feedback').boundingBox())?.height).toBe(before?.height)
})

test('native dialogs, menus and combobox close one interaction at a time and return real focus', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Open dialog', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit sample' })
  await browserExpect(dialog).toBeVisible()

  const candidate = page.getByRole('combobox', { name: 'Candidate' })
  await candidate.focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await browserExpect(candidate).toBeFocused()
  await page.keyboard.press('Enter')
  await browserExpect(candidate).toHaveValue('Beta')

  await candidate.press('ArrowDown')
  await candidate.evaluate((node) => {
    node.closest('fieldset')!.disabled = true
  })
  await browserExpect(dialog.getByRole('listbox')).toHaveCount(0)
  await browserExpect(candidate).toBeDisabled()
  await candidate.evaluate((node) => {
    node.closest('fieldset')!.disabled = false
  })

  await page.evaluate(() => window.fixture.setOptions())
  await browserExpect(candidate).toHaveValue('Beta')
  await candidate.press('ArrowDown')
  await candidate.press('Escape')
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

  await page.getByRole('button', { name: 'Nested dialog' }).click()
  await page.getByRole('button', { name: 'Return', exact: true }).click()
  await browserExpect(page.getByRole('button', { name: 'Nested dialog' })).toBeFocused()

  await page.getByLabel('Block close').check()
  await page.keyboard.press('Escape')
  await browserExpect(dialog).toBeVisible()

  await page.getByLabel('Block close').uncheck()
  await page.getByRole('button', { name: 'Close editor' }).click()
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

test('toast clocks pause, updates retain focus, and disposed owners cannot resurrect messages', async ({
  page,
}) => {
  await page.clock.install()
  await page.evaluate(() => window.fixture.showLoading(false))
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
    window.fixture.lateToast()
  })
  await browserExpect(page.getByText('Sample ready', { exact: true })).toHaveCount(0)
  await browserExpect(page.getByText('Late update', { exact: true })).toHaveCount(0)
  await browserExpect(page.getByText('Late creation', { exact: true })).toHaveCount(0)
  await browserExpect(page.getByText('Window owner survives', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Open dialog', exact: true }).click()
  await page.evaluate(() => window.fixture.showLoading(false))
  await page.getByRole('button', { name: 'Inspect sample' }).click()
  await browserExpect(page.locator('body')).toHaveAttribute('data-action', 'inspected')
  await page.getByRole('button', { name: 'Close editor' }).click()
  await page.evaluate(() => window.fixture.lateToast())
  await browserExpect(page.getByText('Preparing sample', { exact: true })).toHaveCount(0)
  await browserExpect(page.getByText('Late creation', { exact: true })).toHaveCount(0)
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

  await page.evaluate(() => {
    window.fixture.editorSelect?.()
    window.fixture.format?.('bold')
  })
  expect(await page.evaluate(() => window.fixture.editorText?.())).toContain('**Sample**')
  await page.evaluate(() => window.fixture.format?.('undo'))
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
