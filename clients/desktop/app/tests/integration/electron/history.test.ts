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
          type: 'scanner.scan',
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
          status: 'failed',
          result: { adopted: 2, skipped: 1 },
          error: { code: 'OperationFailed', message: 'The provider was unavailable.' },
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

test('opens and removes individual task records and clears history across filters', async ({
  desktop,
}) => {
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Task center' }).click()
  await page.getByRole('tab', { name: 'Finished', exact: true }).click()
  const type = page.getByRole('combobox', { name: 'Task type', exact: true })
  await type.click()
  await expect(page.getByRole('option', { name: 'Directory scan', exact: true })).toBeVisible()
  await type.press('Escape')
  await expect(page.getByRole('columnheader', { name: 'Task type', exact: true })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: 'Error', exact: true })).toHaveCount(0)

  const failed = page.getByRole('row').filter({ hasText: 'Imported collection' })
  await expect(failed.getByText('Failed', { exact: true })).toBeVisible()
  await expect(failed.getByText('The provider was unavailable.')).toHaveCount(0)
  await failed.getByRole('button', { name: 'Task details' }).click()
  const failureDetails = page.getByRole('dialog', { name: 'Imported collection', exact: true })
  await expect(failureDetails.getByText('The provider was unavailable.')).toBeVisible()
  await expect(failureDetails.getByText('Directory scan', { exact: true })).toBeVisible()
  await failureDetails.getByRole('button', { name: 'Close', exact: true }).click()

  const search = page.getByRole('searchbox')
  await search.fill('Interrupted')
  const row = page.getByRole('row').filter({ hasText: 'Interrupted import' })
  const details = row.getByRole('button', { name: 'Task details' })
  await expect(page.getByRole('button', { name: 'Task details' })).toHaveCount(1)
  await details.click()
  const detail = page.getByRole('dialog', { name: 'Interrupted import' })
  await expect(
    detail.locator('[data-tone="warning"]').filter({ hasText: /^Interrupted$/ }),
  ).toBeVisible()
  await expect(detail.getByText('adopted', { exact: true })).toBeVisible()
  await expect(detail.locator('dd').filter({ hasText: /^1$/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(search).toHaveValue('Interrupted')
  await expect(details).toBeFocused()

  const remove = row.getByRole('button', { name: 'Delete task record' })
  await remove.click()
  const confirmation = page.getByRole('alertdialog')
  await expect(confirmation.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await confirmation.getByRole('button', { name: 'Cancel' }).click()
  await expect(remove).toBeFocused()
  await remove.click()
  await confirmation.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(row).toHaveCount(0)

  // The remaining record is hidden by the search, but clearing applies to the entire history.
  const clear = page.getByRole('button', { name: 'Clear history', exact: true })
  await clear.click()
  await confirmation.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(confirmation).toBeHidden()
  await expect(clear).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Clear search', exact: true }).click()
  await expect(page.getByText('No finished tasks', { exact: true })).toBeVisible()
})
