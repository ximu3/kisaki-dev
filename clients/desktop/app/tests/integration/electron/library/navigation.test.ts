import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { libraryStorage } from '../../../../src/main/features/library/storage'
import { initializeDatabase } from '../../../../src/main/infrastructure/database'
import { expect, test } from '../../../support/electron'
import { storageOptions } from '../../database/sample'

test.use({
  profile: async ({}, use) => {
    const root = await mkdtemp(join(tmpdir(), 'kisaki-library-navigation-'))
    try {
      const storage = initializeDatabase(storageOptions(root))
      try {
        const db = libraryStorage(storage)
        for (let i = 0; i < 1200; i++) {
          db.createLibraryEntry(
            {
              type: 'game',
              evaluation: { favorite: true },
              name: 'Catalog ' + String(i).padStart(4, '0'),
            },
            [],
          )
        }
        db.addSections(
          [
            {
              name: 'Catalog',
              layout: 'grid',
              itemSize: 'md',
              limit: null,
              isVisible: true,
              openMode: 'page',
              query: {
                kind: 'entry',
                scope: { type: 'library' },
                search: '',
                rules: [
                  { enabled: true, types: ['game'], filter: { match: 'all', conditions: [] } },
                ],
                sort: { type: 'field', field: 'name', direction: 'asc' },
                referenceLabels: [],
              },
            },
          ],
          true,
        )
      } finally {
        storage.close()
      }
      await use(root)
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 4 })
    }
  },
})

test('locates a distant work in the Explorer and returns to the same card in its original showcase', async ({
  desktop,
}) => {
  const page = await desktop.firstWindow(),
    title = 'Catalog 1199'
  const shelf = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Catalog', exact: true }) })
    .last()
  await expect(shelf.getByRole('button', { name: 'Catalog 0000', exact: true })).toBeVisible()
  await shelf.evaluate((node) => {
    let scroll = node.parentElement
    while (scroll && !['scroll', 'auto'].includes(getComputedStyle(scroll).overflowY)) {
      scroll = scroll.parentElement
    }
    if (!scroll) {
      throw new Error('Missing showcase viewport')
    }
    scroll.scrollTop = scroll.scrollHeight
  })
  const card = shelf.getByRole('button', { name: title, exact: true })
  await expect(card).toBeInViewport()
  await card.click()
  const explorer = page.locator('aside').getByRole('button', { name: new RegExp(title) })
  await expect(explorer).toBeInViewport()
  await expect(explorer).toHaveAttribute('aria-current', 'true')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(card).toBeInViewport()
  await expect(shelf.getByRole('button', { name: 'Catalog 0000', exact: true })).toHaveCount(0)
})

test('returns to the same visible row and selection in a paged table', async ({ desktop }) => {
  const page = await desktop.firstWindow()
  await page.locator('aside').getByRole('button', { name: 'Favorites', exact: true }).click()
  const browse = page.getByRole('region', { name: 'Favorites', exact: true })
  await browse.getByRole('button', { name: 'Table', exact: true }).click()
  await browse.getByRole('button', { name: 'Next', exact: true }).click()
  const row = browse.locator('tbody tr').nth(79)
  await row.scrollIntoViewIfNeeded()
  const name = await row.getByRole('button').innerText()
  await row.getByRole('button').click()
  await expect(browse).toHaveCount(0)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  const selected = browse.getByRole('button', { name, exact: true })
  await expect(selected).toBeInViewport()
  await expect(selected).toHaveAttribute('aria-pressed', 'true')
})

test('opens showcase details in a dialog and returns to its original section', async ({
  desktop,
  profile,
}) => {
  const storage = initializeDatabase(storageOptions(profile))
  try {
    const library = libraryStorage(storage)
    const [section] = library.listShowcase()
    library.editSection(section!.id, { changes: { openMode: 'dialog' } }, true)
  } finally {
    storage.close()
  }
  const page = await desktop.firstWindow()
  await page.reload()
  const card = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Catalog', exact: true }) })
    .last()
    .getByRole('button', { name: 'Catalog 0000', exact: true })
  await card.click()
  const detail = page.getByRole('dialog', { name: 'Catalog 0000', exact: true })
  await expect(detail.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible()
  await detail.getByRole('tab', { name: 'Notes', exact: true }).click()
  await expect(detail.getByRole('tab', { name: 'Notes', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await detail.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(detail).toHaveCount(0)
  await expect(card).toBeInViewport()
})
