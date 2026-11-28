import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '../../support/electron'
import { storageOptions } from '../database/sample'
import { initializeDatabase } from '../../../src/main/infrastructure/database'
import { entries } from '../../../src/main/infrastructure/database/schema'
import { libraryStorage } from '../../../src/main/features/library/storage'

test.use({
  profile: async ({}, use) => {
    const root = await mkdtemp(join(tmpdir(), 'kisaki-library-selection-'))
    try {
      const storage = initializeDatabase(storageOptions(root))
      try {
        const library = libraryStorage(storage)
        library.createLibraryEntry(
          { type: 'game', name: 'First work', evaluation: { favorite: true } },
          [],
        )
        library.createLibraryEntry(
          { type: 'novel', name: 'Last work', evaluation: { favorite: true } },
          [],
        )
        library.createLibraryEntry(
          { type: 'person', name: 'Writer', evaluation: { favorite: true } },
          [],
        )
        library.addLibraryTag({ name: 'Shared tag' }, [])
      } finally {
        storage.close()
      }
      await use(root)
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 4 })
    }
  },
})
test('applies actions to the fixed mixed selection and records completions for works only', async ({
  desktop,
  profile,
}) => {
  const page = await desktop.firstWindow()
  const side = page.locator('aside')
  const row = (name: string) => side.getByRole('button', { name, exact: true })
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  await side.getByRole('button', { name: /^Entry types/ }).click()
  await page.getByRole('button', { name: 'All entries', exact: true }).click()
  await row('First work').click()
  await row('Writer').click({ modifiers: [modifier] })
  await row('Writer').click({ button: 'right' })
  const menu = page.getByRole('menu')
  await expect(menu.getByText('2 items selected')).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Set status' })).toBeDisabled()
  await menu.getByRole('menuitem', { name: 'Add tags', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('checkbox', { name: 'Shared tag' }).check()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)

  await row('Last work').click({ button: 'right' })
  await expect(menu.getByText('1 item selected')).toBeVisible()
  await expect(row('First work')).toHaveAttribute('aria-current', 'true')
  await page.keyboard.press('Escape')
  await row('First work').click({ modifiers: [modifier] })
  await row('Last work').click({ button: 'right' })
  await menu.getByRole('menuitem', { name: 'Set status' }).click()
  await page.getByRole('menuitem', { name: 'In progress', exact: true }).click()
  const storage = initializeDatabase(storageOptions(profile))
  try {
    const library = libraryStorage(storage)
    const refs = storage.db
      .select({ name: entries.name, id: entries.id, type: entries.type })
      .from(entries)
      .orderBy(entries.name)
      .all()
    expect(
      refs.map((ref) => library.readEntryOrganizers(ref, true, true).tags.map((tag) => tag.name)),
    ).toEqual([['Shared tag'], [], ['Shared tag']])
    const records = () =>
      refs
        .map((ref) => library.readLibraryEntry(ref, true))
        .flatMap((entry) => (entry && 'record' in entry ? [entry.record.status] : []))
    await expect.poll(records).toEqual(['active', 'active'])
    await row('First work').focus()
    await page.keyboard.press('Shift+F10')
    await page.getByRole('menuitem', { name: 'Set status' }).click()
    await page.getByRole('menuitem', { name: /Record completion/ }).click()
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(records()).toEqual([null, null])
    for (const ref of refs) {
      if (ref.type === 'game' || ref.type === 'novel') {
        expect(
          library.readCompletions({ type: ref.type, id: ref.id }, { offset: 0, limit: 1 }, true)
            .total,
        ).toBe(1)
      }
    }
  } finally {
    storage.close()
  }
})
test('retains a full-query selection when switching between cards and the table', async ({
  desktop,
}) => {
  const page = await desktop.firstWindow()
  await page.locator('aside').getByRole('button', { name: 'Favorites', exact: true }).click()
  const browse = page.getByRole('region', { name: 'Favorites', exact: true })
  const card = browse.getByRole('button', { name: /First work/ })
  await card.focus()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a')
  await expect(browse.getByText('3 items selected')).toBeVisible()
  await browse.getByRole('button', { name: 'Table', exact: true }).click()
  await expect(browse.getByRole('button', { name: 'Writer' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await browse.getByRole('button', { name: 'Writer' }).click({ button: 'right' })
  await expect(page.getByRole('menu').getByText('3 items selected')).toBeVisible()
  await page.keyboard.press('Escape')
  await browse.getByRole('button', { name: 'First work' }).focus()
  await page.keyboard.press('Escape')
  await expect(browse.getByRole('button', { name: 'Writer' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})
