import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '../../support/electron'
import { storageOptions } from '../database/sample'
import { initializeDatabase } from '../../../src/main/infrastructure/database'
import { libraryStorage } from '../../../src/main/features/library/storage'

test.use({
  profile: async ({}, use) => {
    const root = await mkdtemp(join(tmpdir(), 'kisaki-library-navigation-'))
    try {
      const storage = initializeDatabase(storageOptions(root))
      try {
        const db = libraryStorage(storage)
        for (let i = 0; i < 1200; i++) {
          db.createLibraryEntry({ type: 'game', name: 'Catalog ' + String(i).padStart(4, '0') }, [])
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
