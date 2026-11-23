import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '../../support/electron'
import { storageOptions } from '../database/sample'
import { initializeDatabase } from '../../../src/main/infrastructure/database'
import { taskHistory } from '../../../src/main/features/tasks/history'
import type { TaskRun } from '@kisaki3/desktop-contracts/tasks'

test.use({
  /** Seeds multiple read intervals and a confirmed checkpoint from a process that did not finish. */
  profile: async ({}, use) => {
    const root = await mkdtemp(join(tmpdir(), 'kisaki-task-center-'))
    try {
      const storage = initializeDatabase(storageOptions(root))
      try {
        const history = taskHistory(storage)
        const recent = Date.UTC(2000, 0, 1)
        const base: TaskRun = {
          id: 'sample-run',
          type: 'scanner.scan',
          title: 'Imported collection',
          description: null,
          status: 'running',
          input: { selected: 3 },
          result: null,
          error: null,
          createdAt: recent,
          startedAt: recent,
          finishedAt: null,
        }

        history.startTask(base)
        history.finishTask({
          ...base,
          status: 'failed',
          result: { adopted: 2, skipped: 1, retryCount: 0 },
          error: { code: 'OperationFailed', message: 'The provider was unavailable.' },
          finishedAt: recent + 1,
        })
        history.startTask({
          ...base,
          id: 'unfinished',
          title: 'Interrupted import',
          createdAt: recent + 2,
          startedAt: recent + 2,
        })
        history.checkpointTask('unfinished', { adopted: 1 })

        for (let index = 1; index <= 120; index++) {
          const createdAt = recent - index * 1000
          const run = {
            ...base,
            id: `batch-${index}`,
            title: `Batch task ${index}`,
            type: index === 105 || index === 115 ? 'scanner.scan' : 'library.refresh',
            createdAt,
            startedAt: createdAt,
          }
          history.startTask(run)
          history.finishTask({
            ...run,
            status: index === 115 ? 'cancelled' : 'completed',
            result: index === 120 ? { elapsedMs: 0, updated: 0 } : null,
            finishedAt: createdAt + 500,
          })
        }
      } finally {
        storage.close()
      }
      await use(root)
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 4 })
    }
  },
})

test('scrolls and filters complete task history, opens details and clears records', async ({
  desktop,
}) => {
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Task center' }).click()
  const finished = page.getByRole('tab', { name: 'Finished', exact: true })
  await finished.click()

  const type = page.getByRole('combobox', { name: 'Task type', exact: true })
  const scan = page.getByRole('option', { name: 'Directory scan', exact: true })
  await type.click()
  await expect(scan).toBeVisible()
  await type.press('Escape')
  await expect(page.getByRole('columnheader', { name: 'Task type', exact: true })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: 'Error', exact: true })).toHaveCount(0)

  const failed = page.getByRole('row').filter({ hasText: 'Imported collection' })
  await expect(failed.getByText('Failed', { exact: true })).toBeVisible()
  await expect(failed.getByText('The provider was unavailable.')).toHaveCount(0)
  const failedDetails = failed.getByRole('button', { name: 'Task details' })
  await failedDetails.click()
  const failureDetails = page.getByRole('dialog', { name: 'Imported collection', exact: true })
  await expect(failureDetails.getByText('The provider was unavailable.')).toBeVisible()
  await expect(failureDetails.getByText('Last recorded result', { exact: true })).toBeVisible()
  await expect(
    failureDetails
      .locator('dt')
      .filter({ hasText: /^retryCount$/ })
      .locator('..')
      .locator('dd'),
  ).toHaveText('0')
  await expect(failureDetails.getByText('Directory scan', { exact: true })).toBeVisible()
  await expect(failureDetails.locator('pre')).toHaveCount(0)
  await failureDetails
    .locator('summary')
    .filter({ hasText: /^Input$/ })
    .click()
  await expect(failureDetails.locator('pre')).toContainText('"selected": 3')
  await failureDetails.getByRole('button', { name: 'Close', exact: true }).click()

  const table = page.getByRole('table', { name: 'History', exact: true })
  const header = table.locator('thead')
  const body = table.locator('tbody')
  const viewport = table.locator('..')
  const taskDetails = table.getByRole('button', { name: 'Task details' })
  await expect(header).toBeInViewport()
  const headerStart = (await header.boundingBox())!
  expect((await body.boundingBox())!.y).toBeCloseTo(headerStart.y + headerStart.height, 0)
  expect(
    await viewport.evaluate(
      (body) =>
        ['auto', 'scroll'].includes(getComputedStyle(body).overflowY) &&
        body.scrollHeight > body.clientHeight,
    ),
  ).toBe(true)
  expect(await taskDetails.count()).toBeLessThan(50)
  for (const label of ['Previous', 'Next']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0)
  }

  const rowHeight = (await failed.boundingBox())!.height
  await viewport.hover()
  await page.mouse.wheel(0, rowHeight * 52)
  await expect(table.getByRole('cell', { name: 'Batch task 52', exact: true })).toBeInViewport()
  await expect(failedDetails).toBeFocused()

  const lastTask = table.getByRole('row').filter({
    has: page.getByRole('cell', { name: 'Batch task 120', exact: true }),
  })
  await expect(lastTask).toHaveCount(0)
  await viewport.press('End')
  await expect(lastTask).toBeInViewport()
  await expect(failed).toHaveCount(0)
  expect(await taskDetails.count()).toBeLessThan(50)
  expect((await header.boundingBox())!.y).toBeCloseTo(headerStart.y, 0)

  const lastDetails = lastTask.getByRole('button', { name: 'Task details' })
  await lastDetails.click()
  const zeroDetails = page.getByRole('dialog', { name: 'Batch task 120' })
  await expect(
    zeroDetails
      .locator('dt')
      .filter({ hasText: /^elapsedMs$/ })
      .locator('..')
      .locator('dd'),
  ).toHaveText('0')
  await expect(zeroDetails.locator('pre')).toHaveCount(0)
  await zeroDetails
    .locator('summary')
    .filter({ hasText: /^Output$/ })
    .press('Enter')
  await expect(zeroDetails.locator('pre')).toContainText('"updated": 0')
  await page.keyboard.press('Escape')
  await expect(lastDetails).toBeFocused()
  await expect(lastTask).toBeInViewport()

  await page.getByRole('tab', { name: 'Active', exact: true }).click()
  await expect(page.getByText('No active tasks', { exact: true })).toBeVisible()
  await finished.click()
  await expect(lastTask).toBeInViewport()

  await type.click()
  await scan.click()
  await expect(page.getByText('4 tasks', { exact: true })).toBeVisible()
  const status = page.getByRole('combobox', { name: 'Status', exact: true })
  await status.click()
  await page.getByRole('option', { name: 'Completed', exact: true }).click()
  await expect(page.getByText('1 task', { exact: true })).toBeVisible()
  await expect(table.getByRole('cell', { name: 'Batch task 105', exact: true })).toBeInViewport()
  await expect(taskDetails).toHaveCount(1)

  const search = page.getByRole('searchbox')
  await search.fill('Interrupted')
  await expect(page.getByText('No matching tasks', { exact: true })).toBeVisible()
  await status.click()
  await page.getByRole('option', { name: 'All statuses', exact: true }).click()
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

  // Clearing applies to the whole history while both search and type filters are active.
  const clear = page.getByRole('button', { name: 'Clear history', exact: true })
  await clear.click()
  await confirmation.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(confirmation).toBeHidden()
  await expect(clear).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Clear search', exact: true }).click()
  await type.click()
  await page.getByRole('option', { name: 'All types', exact: true }).click()
  await expect(page.getByText('No finished tasks', { exact: true })).toBeVisible()
})
