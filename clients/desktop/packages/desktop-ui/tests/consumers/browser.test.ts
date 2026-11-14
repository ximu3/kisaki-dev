/** @fileoverview Real browser acceptance for packed controls, modal composition and resource lifetimes. */

import { lintConsumer } from '@kisaki3/tooling/testing/consumer'
import { expect } from 'vite-plus/test'
import { expect as browserExpect } from '@playwright/test'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { runPnpm } from '@kisaki3/tooling/process'
import { consumerTest as test, packageRoot } from './consumer'
import type {} from '../fixtures/workshop/api'

test('packed declarations pass complete Bundler and NodeNext checks and typed consumer lint', async ({
  consumerDirectory,
  signal,
}) => {
  await runPnpm(['typecheck'], { cwd: consumerDirectory, signal })
  await lintConsumer(consumerDirectory)
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
