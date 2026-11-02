/** @fileoverview Verifies actual Node cancellation and retention of failures through async cleanup. */

import { expect, test } from 'vitest'
import { setTimeout as delay } from 'node:timers/promises'
import { isCancellation, rethrowAfterCleanup } from '../src/errors'

test('only the supplied cancellation reason and its Node wrapper count as cancellation', async () => {
  const controller = new AbortController()
  const reason = new Error('Synthetic cancellation')
  controller.abort(reason)
  const wrapped = await delay(0, undefined, { signal: controller.signal }).catch(
    (cause: unknown) => cause,
  )

  expect(isCancellation(reason, controller.signal)).toBe(true)
  expect(isCancellation(wrapped, controller.signal)).toBe(true)
  expect(isCancellation(new Error('Synthetic concurrent failure'), controller.signal)).toBe(false)
  expect(isCancellation(reason, new AbortController().signal)).toBe(false)
})

test('a failed operation waits for cleanup and retains its original failure', async () => {
  const failure = new Error('Synthetic preparation failure')
  let cleaned = false
  const result = rethrowAfterCleanup(
    failure,
    async () => {
      await delay(0)
      cleaned = true
    },
    'Operation and cleanup failed',
  )

  await expect(result).rejects.toBe(failure)
  expect(cleaned).toBe(true)
})

test('cleanup failure preserves both failures and their causes', async () => {
  const failure = new Error('Synthetic preparation failure')
  const cleanup = new Error('Synthetic cleanup failure')
  await expect(
    rethrowAfterCleanup(
      failure,
      async () => {
        throw cleanup
      },
      'Operation and cleanup failed',
    ),
  ).rejects.toMatchObject({
    cause: cleanup,
    errors: [failure, cleanup],
  })
})
