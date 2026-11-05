/** @fileoverview Checks real controls, focus, visuals and resource ownership through the packed package. */

import { expect } from 'vitest'
import { join } from 'node:path'
import { runPnpm } from '@kisaki3/tooling/process'
import { lintConsumer, reportDirectory, test } from '../support/consumer'

test('the complete public declarations work with Bundler and NodeNext resolution', async ({
  consumer,
  signal,
}) => {
  await runPnpm(['typecheck'], { cwd: consumer, signal })
  await lintConsumer(consumer)
})

test('a stable drag owner follows edge scrolling past the unmounted source, cancellation and a rejected move', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Reading order', exact: true }).click()
  const list = page.locator('#titles')
  const start = await page.getByRole('button', { name: 'Move A', exact: true }).boundingBox()
  const viewport = await list.boundingBox()
  if (!start || !viewport) {
    throw new Error('The reorder list must be visible.')
  }
  const x = start.x + start.width / 2
  const y = start.y + start.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 12, y + 8, { steps: 4 })
  await page.mouse.move(x, viewport.y + viewport.height - 2, { steps: 8 })
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThanOrEqual(95)
  expect(await page.locator('[data-row=A]').count()).toBe(0)
  await page.mouse.move(x + 2, viewport.y + viewport.height - 3)
  await page.mouse.up()
  expect(await page.locator('#order').textContent()).toBe('BCDEA')

  await page.getByRole('button', { name: 'Switch layout' }).click()
  const from = await page.getByRole('button', { name: 'Move B', exact: true }).boundingBox()
  const to = await page.locator('[data-row=C]').boundingBox()
  if (!from || !to) {
    throw new Error('The grid must contain both move targets.')
  }
  await page.mouse.move(from.x + 6, from.y + 6)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width - 5, to.y + 8, { steps: 8 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  expect(await page.locator('#order').textContent()).toBe('BCDEA')

  await page.getByRole('button', { name: 'Reject next move' }).click()
  await page
    .getByRole('button', { name: 'Move B', exact: true })
    .dragTo(page.locator('[data-row=C]'), { targetPosition: { x: to.width - 5, y: 8 } })
  await page.getByText('Library order changed', { exact: true }).waitFor()
  expect(await page.locator('#order').textContent()).toBe('DCBAE')
})

test('form drafts, rejected resets, constraints and successful controls agree with the native form', async ({
  page,
}) => {
  const form = page.locator('#entry')
  const values = () =>
    form.evaluate((node) => Array.from(new FormData(node as HTMLFormElement).entries()))
  const title = page.getByLabel('Title', { exact: true })
  await title.fill('Revised title')
  await page.getByLabel('Medium', { exact: true }).selectOption('comic')
  await page.getByLabel('Favourite', { exact: true }).check()
  await page.getByLabel('Notify me').check()
  expect(await values()).toContainEqual(['formats', 'novel'])
  expect(await values()).toContainEqual(['formats', 'comic'])

  await form.evaluate((node) =>
    node.addEventListener('reset', (e) => e.preventDefault(), { once: true }),
  )
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  expect(await title.inputValue()).toBe('Revised title')
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  expect(await title.inputValue()).toBe('Blue Hour')
  expect(await page.getByLabel('Medium', { exact: true }).inputValue()).toBe('novel')
  expect(await page.getByLabel('Favourite', { exact: true }).isChecked()).toBe(true)
  expect(await page.getByLabel('Notify me').isChecked()).toBe(false)
  await expect
    .poll(async (): Promise<unknown> => JSON.parse((await page.locator('#draft').textContent())!))
    .toMatchObject({ title: 'Blue Hour', medium: 'novel', checked: true })

  await page.getByText('Change formats', { exact: true }).click()
  expect(await form.evaluate((node) => (node as HTMLFormElement).checkValidity())).toBe(false)
  expect((await values()).filter(([key]) => key === 'medium')).toEqual([])
  await page.getByText('Lock fields', { exact: true }).click()
  expect(await values()).toEqual([])

  await page.getByText('Lock fields', { exact: true }).click()
  const ime = await page.context().newCDPSession(page)
  await title.selectText()
  await ime.send('Input.imeSetComposition', { text: '編集中', selectionStart: 3, selectionEnd: 3 })
  await page
    .getByRole('button', { name: 'Rename', exact: true })
    .evaluate((el) => (el as HTMLButtonElement).click())
  expect(await title.inputValue()).toBe('編集中')
  await ime.send('Input.insertText', { text: '編集済み' })
  expect(JSON.parse((await page.locator('#draft').textContent())!)).toMatchObject({
    title: '編集済み',
  })
  await ime.detach()
})

test('combobox accepts a loaded option with the keyboard and preserves selection across searches', async ({
  page,
}) => {
  const input = page.getByRole('combobox', { name: 'Shelf' })
  await input.fill('back')
  await input.press('ArrowDown')
  expect(await input.getAttribute('aria-activedescendant')).toBe(
    await page.getByRole('option', { name: 'Backlog' }).getAttribute('id'),
  )
  await input.press('Enter')
  expect(await input.inputValue()).toBe('Backlog')
  await input.fill('unavailable')
  await input.press('Escape')
  expect(await input.inputValue()).toBe('Backlog')
  expect(
    await page
      .locator('#entry')
      .evaluate((node) => new FormData(node as HTMLFormElement).get('shelf')),
  ).toBe('s2')
})

test('modal intent can be refused; nested dialogs contain focus and restore each invoker', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Edit entry' })
  await trigger.click()
  await page.getByLabel('Keep editing').check()
  await page.keyboard.press('Escape')
  expect(await page.getByRole('dialog', { name: 'Edit entry' }).isVisible()).toBe(true)
  await page.getByRole('button', { name: 'Remove cover' }).click()
  expect(await page.getByRole('alertdialog', { name: 'Remove cover?' }).isVisible()).toBe(true)
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('Remove cover')
  await page.getByLabel('Keep editing').uncheck()
  await page.getByRole('button', { name: 'Close editor' }).click()
  expect(await trigger.evaluate((el) => el === document.activeElement)).toBe(true)
})

test('menus, anchored hints, tab selection and feedback use the keyboard in the owning view', async ({
  page,
}) => {
  const actions = page.getByRole('button', { name: 'Actions', exact: true })
  await actions.press('ArrowDown')
  expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('Copy title')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  expect(await page.getByRole('status').filter({ hasText: 'Pinned entry' }).isVisible()).toBe(true)
  await page.getByRole('button', { name: 'Dismiss' }).click()

  await page.getByText('Blue Hour', { exact: true }).first().click({ button: 'right' })
  await page.keyboard.press('c')
  await page.keyboard.press('Enter')
  expect(await page.getByRole('status').filter({ hasText: 'Copied title' }).isVisible()).toBe(true)
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  expect(await page.getByRole('link', { name: 'Related titles' }).isVisible()).toBe(true)
  await page.keyboard.press('Escape')
  const help = page.getByRole('button', { name: 'Help' })
  await help.focus()
  await page.getByRole('tooltip').waitFor()
  await page.keyboard.press('Escape')
  expect(await page.getByRole('tooltip').count()).toBe(0)
  await page.getByRole('tab', { name: 'Content', exact: true }).press('ArrowRight')
  expect(await page.getByRole('tabpanel', { name: 'Related' }).isVisible()).toBe(true)
})

test('standalone CSS preserves document layout and follows live appearance overrides', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const button = page.getByRole('button', { name: 'Edit entry' })
  const size = () =>
    button.evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      color: getComputedStyle(el).backgroundColor,
    }))
  const light = await size()
  expect(light.height).toBe(24.5)
  expect(await page.locator('body').evaluate((el) => getComputedStyle(el).margin)).toBe('8px')
  await button.focus()
  await page.screenshot({ path: join(reportDirectory, 'controls-light.png') })
  await page.locator('html').evaluate((el) => el.setAttribute('data-color-scheme', 'dark'))
  expect((await size()).color).not.toBe(light.color)
  await page.screenshot({ path: join(reportDirectory, 'controls-dark.png') })
  await page.locator('html').evaluate((el) => {
    el.style.setProperty('--primary', 'rgb(120 80 60)')
    el.style.setProperty('--interface-scale', '150')
  })
  await expect.poll(async () => (await size()).color).toBe('rgb(120, 80, 60)')
  expect((await size()).height).toBeCloseTo(36.75)
})

test('action variants expose focus, hover, press and disabled states at the supported density', async ({
  page,
  site,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(new URL('?states', site).href)
  const action = page.getByRole('button', { name: 'Choose', exact: true }).first()
  const color = () => action.evaluate((el) => getComputedStyle(el).backgroundColor)
  const normal = await color()
  await action.hover()
  const hover = await color()
  await page.mouse.down()
  expect(await color()).not.toBe(hover)
  await page.mouse.up()
  expect(hover).not.toBe(normal)
  const invalid = page.getByLabel('Title', { exact: true })
  await invalid.focus()
  await invalid.press('Tab')
  await page.keyboard.press('Shift+Tab')
  expect(await invalid.evaluate((el) => el.matches(':focus-visible'))).toBe(true)
  expect(await invalid.getAttribute('aria-invalid')).toBe('true')
  const destructive = page.locator('.samples button:enabled').nth(1)
  expect(await invalid.evaluate((el) => getComputedStyle(el).borderColor)).toBe(
    await destructive.evaluate((el) => getComputedStyle(el).backgroundColor),
  )
  expect(await page.locator('.samples button:disabled').count()).toBe(8)
  await page.screenshot({ path: join(reportDirectory, 'variants-light.png') })
  await page.locator('html').evaluate((el) => el.setAttribute('data-color-scheme', 'dark'))
  await page.screenshot({ path: join(reportDirectory, 'variants-dark.png') })
  await page.goto(new URL('?states#modal', site).href)
  await page.reload()
  await page.getByRole('dialog', { name: 'Collection' }).waitFor()
})

test('Markdown uses safe host-bound resources, isolated anchors and one disposable editor', async ({
  page,
}) => {
  const external: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('invalid.example')) {
      external.push(request.url())
    }
  })
  await page.getByRole('button', { name: 'Notes', exact: true }).click()
  const previews = page.locator('.markdown-pair > div')
  await previews.first().waitFor()
  expect(await previews.first().locator('table').count()).toBe(1)
  expect(await previews.first().locator('img').count()).toBe(1)
  expect(await previews.first().locator('input:checked:disabled').count()).toBe(1)
  expect(await previews.first().textContent()).toContain('<img src=x onerror=alert(1)>')
  expect(await previews.first().textContent()).toContain('Missing cover')
  expect(await previews.first().locator('input').getAttribute('id')).not.toBe(
    await previews.last().locator('input').getAttribute('id'),
  )
  const footnote = previews.first().locator('.footnote-ref a[href]')
  await footnote.click()
  expect(
    await page.evaluate(
      () =>
        document.querySelector(':target')?.closest('.ks-markdown') ===
        document.querySelector('.ks-markdown'),
    ),
  ).toBe(true)
  await previews.first().getByRole('link', { name: 'https://example.org' }).click()
  expect(await page.locator('#destination').textContent()).toContain('example.org')
  expect(external).toEqual([])
  await page.getByRole('button', { name: 'Replace text' }).click()
  const editor = page.getByRole('textbox', { name: 'Note source' })
  await editor.press('ControlOrMeta+a')
  await page.getByRole('button', { name: 'Bold', exact: true }).click()
  expect(await editor.textContent()).toContain('**Revised**')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect(await editor.textContent()).toBe('Revised')
  await editor.press('ControlOrMeta+a')
  const ime = await page.context().newCDPSession(page)
  await ime.send('Input.imeSetComposition', { text: '入力中', selectionStart: 3, selectionEnd: 3 })
  await page
    .getByRole('button', { name: 'Replace text' })
    .evaluate((el) => (el as HTMLButtonElement).click())
  expect(await editor.textContent()).toContain('入力中')
  await ime.send('Input.insertText', { text: '確定' })
  await expect.poll(() => previews.first().textContent()).toContain('確定')
  await ime.detach()
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  expect(await page.locator('#released').textContent()).toBe('1')
})

test('chart compositions render, update and release both SVG containers', async ({ page }) => {
  await page.evaluate(() => {
    Reflect.set(window, 'UNOVIS_NONCE', 'consumer-nonce')
    const policy = document.createElement('meta')
    policy.httpEquiv = 'Content-Security-Policy'
    policy.content = "style-src-elem 'self' 'nonce-consumer-nonce'"
    document.head.append(policy)
    document.addEventListener('securitypolicyviolation', (event) => {
      document.body.dataset.violation = event.effectiveDirective
    })
  })
  await page.getByRole('button', { name: 'Activity', exact: true }).click()
  const charts = page.locator('.ks-chart svg')
  await charts.first().waitFor()
  expect(await charts.count()).toBe(2)
  const nonces = await page
    .locator('style[data-emotion]')
    .evaluateAll((nodes) => nodes.map((el) => (el as HTMLStyleElement).nonce))
  expect(nonces).toContain('consumer-nonce')
  await charts.first().hover({ position: { x: 220, y: 60 } })
  const tip = page.locator('.ks-chart-tooltip')
  await expect.poll(() => tip.textContent()).toMatch(/<b>\d+<\/b>/)
  expect(await tip.locator('b').count()).toBe(0)
  expect(await page.locator('body').getAttribute('data-violation')).toBeNull()
  await page.getByRole('button', { name: 'Pages', exact: true }).click()
  expect(
    await page.getByRole('button', { name: 'Pages', exact: true }).getAttribute('aria-pressed'),
  ).toBe('false')
  await page.getByRole('button', { name: 'Update activity' }).click()
  expect(await page.getByText('9, 15', { exact: true }).count()).toBe(1)
  await page.screenshot({ path: join(reportDirectory, 'charts.png') })
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  expect(await charts.count()).toBe(0)
  expect(await page.locator('.ks-chart-tooltip').count()).toBe(0)
})

test('keyboard and pointer moves share selection, filtered slots, permission and owner cleanup', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Reading order', exact: true }).click()
  await page.getByRole('button', { name: 'Filter titles' }).click()
  await page.getByRole('button', { name: 'Move E', exact: true }).press('Enter')
  await page.getByRole('menuitem', { name: 'To start' }).press('Enter')
  expect(await page.locator('#order').textContent()).toBe('EBADC')
  await page.getByRole('button', { name: 'Select A and C' }).click()
  await page
    .getByRole('button', { name: 'Move A', exact: true })
    .dragTo(page.locator('[data-row=E]'), { targetPosition: { x: 32, y: 20 } })
  expect(await page.locator('#order').textContent()).toBe('ABCDE')
  await page.getByRole('button', { name: 'Toggle availability' }).click()
  await page
    .getByRole('button', { name: 'Move A', exact: true })
    .dragTo(page.locator('[data-row=E]'))
  expect(await page.locator('#order').textContent()).toBe('ABCDE')
  await page.getByRole('button', { name: 'Toggle list' }).click()
  expect(await page.locator('div[role=status]').count()).toBe(0)
})
