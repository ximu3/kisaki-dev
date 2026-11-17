/** @fileoverview Verifies task details, filters and scope restoration with a nonempty migrated profile. */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '../../support/electron'
import { storageOptions } from '../database/sample'
import { initializeDatabase } from '../../../src/main/infrastructure/database'
import { taskHistory } from '../../../src/main/features/tasks/history'
import type { TaskRun } from '@kisaki3/desktop-contracts/tasks'

test.use({
  /** Leaves one finished run and a confirmed checkpoint from a process that did not finish. */
  profile: async ({}, use) => {
    const root = await mkdtemp(join(tmpdir(), 'kisaki-task-center-'))
    try {
      const storage = initializeDatabase(storageOptions(root))
      try {
        const history = taskHistory(storage)
        const base: TaskRun = {
          id: 'sample-run',
          type: 'sample',
          title: 'Imported collection',
          description: null,
          status: 'running',
          input: { selected: 3 },
          result: null,
          error: null,
          createdAt: 1,
          startedAt: 2,
          finishedAt: null,
        }
        history.startTask(base)
        history.finishTask({
          ...base,
          status: 'completed',
          result: { adopted: 2, skipped: 1 },
          finishedAt: 8,
        })
        const recent = Date.UTC(2000, 0, 1)
        history.startTask({
          ...base,
          id: 'unfinished',
          title: 'Interrupted import',
          createdAt: recent,
          startedAt: recent,
        })
        history.checkpointTask('unfinished', { adopted: 1 })
      } finally {
        storage.close()
      }
      await use(root)
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 4 })
    }
  },
})

test('reopens recorded task results and returns to the same filtered history', async ({
  desktop,
}) => {
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Task center' }).click()
  await page.getByRole('tab', { name: 'Finished (2)' }).click()
  await page.getByRole('searchbox').fill('Interrupted')
  const details = page
    .getByRole('row')
    .filter({ hasText: 'Interrupted import' })
    .getByRole('button', { name: 'Task details' })
  await expect(page.getByRole('button', { name: 'Task details' })).toHaveCount(1)
  await details.click()
  const detail = page.getByRole('dialog', { name: 'Interrupted import' })
  await expect(detail.getByText('Interrupted', { exact: true })).toBeVisible()
  await expect(detail.locator('pre').first()).toContainText('"adopted": 1')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('searchbox')).toHaveValue('Interrupted')
  await expect(details).toBeFocused()

  await page.getByRole('button', { name: 'Clear history', exact: true }).click()
  const clear = page.getByRole('dialog', { name: 'Clear history', exact: true })
  await clear.getByRole('combobox', { name: 'History' }).click()
  await clear.getByRole('option', { name: 'Finished tasks created before a date' }).click()
  await clear.getByLabel('Created before', { exact: true }).fill('1990-01-01')
  await clear.getByRole('button', { name: 'Clear history', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Finished (1)' })).toBeVisible()
  await expect(details).toBeVisible()
})
