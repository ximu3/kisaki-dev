import { test, expect } from '../../support/electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { captionHit } from '../../support/window-observation'
import { appRoot } from '../../../tools/lib/paths'
import { hostTarget } from '../../../tools/lib/targets'

for (const kind of ['main', 'reader', 'player', 'game-panel'] as const) {
  test.describe(kind, () => {
    test.use({ kind })
    test('adopts its own sandboxed document and effective presentation', async ({ desktop }) => {
      const page = await desktop.firstWindow()
      await expect
        .poll(() =>
          desktop.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows().some((w) => w.isVisible()),
          ),
        )
        .toBe(true)
      expect(new URL(page.url()).pathname).toBe('/' + kind + '/index.html')
      expect(
        await page.evaluate(() => ({
          scale: document.documentElement.style.getPropertyValue('--interface-scale'),
          language: document.documentElement.lang,
          node: typeof (globalThis as { process?: unknown }).process,
        })),
      ).toEqual({ scale: '100', language: 'en', node: 'undefined' })
      if (kind === 'main' && process.platform === 'win32') {
        const point = await page.evaluate(() => {
          const overlay = (
            navigator as Navigator & {
              windowControlsOverlay: {
                visible: boolean
                getTitlebarAreaRect(): DOMRect
              }
            }
          ).windowControlsOverlay
          const area = overlay.getTitlebarAreaRect()
          return {
            visible: overlay.visible,
            x: ((area.right + innerWidth) * devicePixelRatio) / 2,
            y: (area.height * devicePixelRatio) / 2,
          }
        })
        expect(point.visible).toBe(true)
        const handle = await desktop.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0]!.getNativeWindowHandle().readBigUInt64LE().toString(),
        )

        expect(await captionHit(handle, point.x, point.y)).toBe(9) // HTMAXBUTTON
      }

      const renderer = await desktop.evaluate(({ app, BrowserWindow }) => {
        const pid = BrowserWindow.getAllWindows()[0]!.webContents.getOSProcessId()
        return { pid, sandboxed: app.getAppMetrics().find((item) => item.pid === pid)?.sandboxed }
      })
      if (process.platform === 'linux') {
        const status = await readFile('/proc/' + renderer.pid + '/status', 'utf8')
        expect(status).toMatch(/^Seccomp:\s+2$/m)
        expect(status).toMatch(/^NoNewPrivs:\s+1$/m)
      } else {
        expect(renderer.sandboxed).toBe(true)
      }
    })
  })
}

test('saves the accepted preference draft and restores it after a document reload', async ({
  desktop,
}) => {
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Application menu' }).click()
  await page.getByRole('menuitem', { name: 'Preferences', exact: true }).click()
  const preferences = page.getByRole('dialog', { name: 'Preferences', exact: true })
  const save = preferences.getByRole('button', { name: 'Save', exact: true })
  const restore = preferences.getByRole('button', { name: 'Restore default', exact: true })
  await preferences.getByRole('tab', { name: 'Appearance', exact: true }).click()
  const scale = preferences.getByRole('spinbutton', { name: 'Interface scale' })
  await scale.fill('120')
  await scale.evaluate((input: HTMLInputElement) => {
    input.form!.requestSubmit()
    input.value = '130'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.style.getPropertyValue('--interface-scale')),
    )
    .toBe('120')
  await expect(scale).toHaveValue('130')
  await scale.fill('120')
  await expect(save).toBeDisabled()

  await preferences.getByRole('tab', { name: 'Using works', exact: true }).click()
  const comics = preferences.getByRole('button', { name: 'Comics', exact: true })
  const novels = preferences.getByRole('button', { name: 'Novels', exact: true })
  const comic = page.getByRole('dialog', { name: 'Comic reading settings' })
  const novel = page.getByRole('dialog', { name: 'Novel reading settings' })
  const fontSize = comic.getByRole('spinbutton', { name: 'Font size', exact: true })

  await comics.click()
  await fontSize.fill('')
  await comic.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(fontSize).toBeFocused()
  await fontSize.fill('28')
  await page.keyboard.press('ControlOrMeta+s')
  await expect(comic).toBeHidden()
  await expect(comics).toBeFocused()

  await novels.click()
  const novelSize = novel.getByRole('spinbutton', { name: 'Font size', exact: true })
  await novelSize.fill('32')
  await page.keyboard.press('Escape')
  await expect(novel).toBeHidden()

  const shortcuts = preferences.getByRole('tab', { name: 'Keyboard shortcuts', exact: true })
  const record = preferences.getByRole('button', {
    name: 'Record a shortcut for Preferences',
    exact: true,
  })
  const recorder = page.getByRole('dialog', { name: 'Record a shortcut for Preferences' })
  const accept = recorder.getByRole('button', { name: 'Confirm', exact: true })
  const bindingField = preferences.locator('[data-field-key="shortcuts.main.preferences"]')
  const original = bindingField.getByRole('button', { name: /^Remove .*, from Preferences$/ })
  const number = bindingField.getByRole('button', { name: /^Remove .*1 from Preferences$/ })
  await shortcuts.click()
  await record.click()
  await page.keyboard.down('Control')
  await page.keyboard.down('Shift')
  await page.keyboard.down('Digit1')
  await expect(recorder.locator('kbd').last()).toHaveText('1')
  await page.keyboard.up('Digit1')
  await page.keyboard.up('Shift')
  await expect(accept).toBeDisabled()
  await page.keyboard.up('Control')
  await expect(number).toHaveCount(0)
  await accept.click()
  await original.click()
  await expect(number).toBeVisible()
  await save.click()
  await expect(save).toBeDisabled()

  await page.reload()
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.style.getPropertyValue('--interface-scale')),
    )
    .toBe('120')
  await page.getByRole('button', { name: 'Application menu' }).click()
  await page.getByRole('menuitem', { name: 'Preferences', exact: true }).click()
  await preferences.getByRole('tab', { name: 'Using works', exact: true }).click()
  await comics.click()
  await expect(fontSize).toHaveValue('28')
  await page.keyboard.press('ControlOrMeta+s')
  await expect(comics).toBeFocused()
  await novels.click()
  await expect(novelSize).toHaveValue('20')
  await page.keyboard.press('Escape')

  await shortcuts.click()
  await expect(number).toBeVisible()
  await restore.click()
  await expect(record).toBeFocused()
  await expect(original).toBeVisible()
  await expect(number).toBeHidden()
  await save.click()
  await expect(save).toBeDisabled()
})

test('the application menu saves theme mode and sensitive-content visibility', async ({
  desktop,
}) => {
  const page = await desktop.firstWindow()
  const trigger = page.getByRole('button', { name: 'Application menu', exact: true })
  const theme = page.getByRole('menuitem', { name: 'Theme mode', exact: true })
  const modes = page.getByRole('menu', { name: 'Theme mode', exact: true })
  const sensitive = page.getByRole('menuitemcheckbox', { name: 'Show sensitive content' })

  await trigger.press('Enter')
  await expect(theme).toBeEnabled()
  await theme.press('ArrowRight')
  await expect(modes.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await modes.getByRole('menuitemradio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark')
  await expect(trigger).toBeFocused()

  await trigger.click()
  await expect(sensitive).toHaveAttribute('aria-checked', 'true')
  await sensitive.click()
  await trigger.click()
  await expect(sensitive).toHaveAttribute('aria-checked', 'false')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark')
  await trigger.click()
  await page.getByRole('menuitem', { name: 'Preferences', exact: true }).click()
  const preferences = page.getByRole('dialog', { name: 'Preferences', exact: true })
  await preferences.getByRole('tab', { name: 'Appearance', exact: true }).click()
  await expect(preferences.getByRole('combobox', { name: 'Theme mode' })).toHaveText('Dark')
  await preferences.getByRole('tab', { name: 'Library', exact: true }).click()
  await expect(
    preferences.getByRole('switch', { name: 'Show sensitive content' }),
  ).not.toBeChecked()
})

test('a dropped font previews before save and can be selected after reopening the library', async ({
  desktop,
}) => {
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Application menu' }).click()
  await page.getByRole('menuitem', { name: 'Font library' }).click()
  const library = page.getByRole('dialog', { name: 'Font library', exact: true })
  await library.getByRole('button', { name: 'Import font' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import font', exact: true })
  const bytes = await readFile(
    join(
      appRoot,
      'out/resources',
      hostTarget(),
      'fonts/noto-sans-mono/files/noto-sans-mono-latin-wght-normal.woff2',
    ),
  )
  await dialog.getByRole('button', { name: 'Add files' }).evaluate((button, input) => {
    const data = new DataTransfer()
    const bytes = Uint8Array.from(atob(input), (c) => c.charCodeAt(0))
    data.items.add(new File([bytes], 'sample.woff2', { type: 'font/woff2' }))
    button.dispatchEvent(
      new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
    )
  }, bytes.toString('base64'))
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue(/Noto Sans Mono/)
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.fonts].some(
          (face) => face.family.startsWith('Kisaki-preview-') && face.status === 'loaded',
        ),
      ),
    )
    .toBe(true)
  await dialog.getByLabel('Name', { exact: true }).fill('Isolated sample')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  const preview = library.getByRole('button', { name: 'Preview Isolated sample', exact: true })
  await expect(preview).toBeFocused()

  await page.evaluate(() => {
    const observer = new MutationObserver((records) => {
      for (const { target } of records) {
        if (
          target instanceof HTMLDialogElement &&
          target.open &&
          target.querySelector('h2')?.textContent === 'Isolated sample'
        ) {
          document.documentElement.dataset.previewReadyOnOpen = String(
            !!target.querySelector('p[style*="Kisaki-preview-"]'),
          )
          observer.disconnect()
        }
      }
    })
    observer.observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true })
  })
  await preview.click()
  const specimen = page.getByRole('dialog', { name: 'Isolated sample', exact: true })
  await expect(
    specimen.getByText('The quick brown fox jumps over the lazy dog.', { exact: false }),
  ).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-preview-ready-on-open', 'true')
  await page.keyboard.press('Escape')
  await expect(preview).toBeFocused()
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.fonts].some((face) => face.family.startsWith('Kisaki-preview-')),
      ),
    )
    .toBe(false)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Application menu' }).click()
  await page.getByRole('menuitem', { name: 'Font library' }).click()
  await expect(preview).toBeVisible()
})

test('saving and selecting a theme preserves the independent preference draft and its return focus', async ({
  desktop,
}) => {
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Application menu' }).click()
  await page.getByRole('menuitem', { name: 'Preferences', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Preferences', exact: true })
  await editor.getByRole('tab', { name: 'Appearance', exact: true }).click()
  const scale = editor.getByRole('spinbutton', { name: 'Interface scale' })
  await scale.fill('115')
  await editor.getByRole('button', { name: 'Manage themes' }).click()
  const themes = page.getByRole('dialog', { name: 'Themes', exact: true })
  await themes.getByRole('button', { name: 'New theme' }).click()
  const themeEditor = page.getByRole('dialog', { name: 'New theme', exact: true })
  await expect(themeEditor.getByRole('switch', { name: 'Preview', exact: true })).toBeVisible()
  const saveAndUse = themeEditor.getByRole('button', { name: 'Save and use', exact: true })
  const footerButtons = saveAndUse.locator('..').locator(':scope > button')
  await expect(footerButtons).toHaveText(['Cancel', 'Save', 'Save and use'])
  expect(
    await footerButtons.evaluateAll((buttons) =>
      buttons.map((item) => item.getAttribute('data-variant')),
    ),
  ).toEqual(['ghost', 'outline', 'default'])
  await themeEditor.getByLabel('Name', { exact: true }).fill('Sample theme')
  const font = themeEditor.getByRole('combobox', { name: 'Interface font', exact: true })
  await font.click()
  await expect(font).toBeFocused()
  // In this empty user library, the first option after the default comes from the OS catalog.
  await page.getByRole('listbox').getByRole('option').nth(1).click()
  await expect(font).toHaveAttribute('aria-expanded', 'false')
  await saveAndUse.click()
  const item = themes.getByRole('listitem').filter({
    has: page.getByText('Sample theme', { exact: true }),
  })
  await expect(item.getByText('In use', { exact: true })).toBeVisible()
  await item.getByRole('button', { name: 'Duplicate Sample theme', exact: true }).click()
  await expect(
    themes.getByRole('button', { name: 'Preview Sample theme (copy)', exact: true }),
  ).toBeFocused()

  const copy = themes.getByRole('listitem').filter({ hasText: 'Sample theme (copy)' })
  const description = copy.getByText('User', { exact: true })
  const before = (await description.boundingBox())!.y - (await copy.boundingBox())!.y
  await copy.getByRole('button', { name: 'Use Sample theme (copy)', exact: true }).click()
  await expect(copy.getByText('In use', { exact: true })).toBeVisible()
  const after = (await description.boundingBox())!.y - (await copy.boundingBox())!.y
  expect(Math.abs(after - before)).toBeLessThan(0.1)
  await item.getByRole('button', { name: 'Use Sample theme', exact: true }).click()
  await expect(item.getByText('In use', { exact: true })).toBeVisible()

  await themes.getByRole('button', { name: 'New theme', exact: true }).click()
  await themeEditor.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click()
  await expect(themeEditor).toBeHidden()
  await themes.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(themes).toBeHidden()
  await expect(scale).toHaveValue('115')
  await expect(editor.getByRole('button', { name: 'Manage themes' })).toBeFocused()

  const confirmation = page.getByRole('alertdialog')
  const confirmSave = confirmation.getByRole('button', { name: 'Save', exact: true })
  const choices = confirmation.getByRole('button')
  await page.keyboard.press('Escape')
  await expect(choices).toHaveText(['Discard changes', 'Keep editing', 'Save'])
  expect(
    await choices.evaluateAll((buttons) => buttons.map((button) => button.dataset.variant)),
  ).toEqual(['ghost', 'outline', 'default'])
  await expect(confirmSave).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(scale).toHaveValue('115')
  await editor.getByRole('button', { name: 'Close', exact: true }).click()
  await confirmation.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(editor).toBeHidden()

  await page.getByRole('button', { name: 'Application menu' }).click()
  await page.getByRole('menuitem', { name: 'Preferences', exact: true }).click()
  await editor.getByRole('tab', { name: 'Appearance', exact: true }).click()
  await expect(scale).toHaveValue('100')
  await expect(editor.getByRole('combobox', { name: 'Theme', exact: true })).toHaveText(
    'Sample theme',
  )
  await scale.fill('110')
  await page.keyboard.press('Escape')
  await expect(confirmSave).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(editor).not.toBeVisible()
  await expect(page.locator('html')).toHaveCSS('--interface-scale', '110')
  await expect(page.getByRole('button', { name: 'Application menu' })).toBeFocused()
})
