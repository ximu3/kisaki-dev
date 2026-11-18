/** @fileoverview Checks that ordered lists submit stable moves by keyboard and native drag. */

import { expect } from '@playwright/test'
import { test } from './page'

test('pointer, keyboard and rejected source moves preserve the complete draft order', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Load resources' }).click()
  const list = page.getByRole('list', { name: 'Source priority' })
  const order = page.locator('[data-source-order]')
  const moveE = list.getByRole('button', { name: 'Move source E' })

  await moveE.click()
  await page.getByRole('menuitem', { name: 'Move to beginning' }).click()
  await expect(order).toHaveText('E,B,A,D,C')
  await expect(moveE).toBeFocused()
  await expect(page.getByRole('status').filter({ hasText: 'Source E moved to 1' })).toHaveCount(1)

  const target = list.getByRole('listitem').filter({ hasText: 'Source E' })
  await list
    .getByRole('button', { name: 'Move source C' })
    .dragTo(target, { targetPosition: { x: 12, y: 3 } })
  await expect(order).toHaveText('A,B,C,D,E')
  await expect(page.getByRole('status').filter({ hasText: '2 sources moved' })).toHaveCount(1)

  await page.getByRole('checkbox', { name: 'Reject source changes' }).check()
  await moveE.press('Alt+ArrowUp')
  await expect(page.getByRole('alert').filter({ hasText: 'Source priority changed' })).toBeVisible()
  await expect(order).toHaveText('A,B,C,D,E')
  await expect(moveE).toBeFocused()
})
