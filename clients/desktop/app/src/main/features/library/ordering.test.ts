/** @fileoverview Verifies ordering behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { reorderSubset, moveWithinOrder } from './ordering'

import { DesktopError } from '@kisaki3/desktop-contracts/errors'

/** Observe the machine category, preserving unexpected implementation errors instead of treating them as expected rejection. */
function failureCode(operation: () => unknown): string {
  try {
    operation()
  } catch (error) {
    if (error instanceof DesktopError) {
      return error.code
    }

    throw error
  }

  throw new Error('Expected the operation to fail')
}

test('subset reorder preserves other slots while current-position moves fail on a stale anchor', () => {
  const current = ['a', 'b', 'c', 'd', 'e']

  expect(reorderSubset(current, { order: ['e', 'b'], expected: { order: current } })).toEqual([
    'a',
    'e',
    'c',
    'd',
    'b',
  ])

  expect(moveWithinOrder(current, { ids: ['d', 'b'], before: 'a' })).toEqual([
    'd',
    'b',
    'a',
    'c',
    'e',
  ])

  expect(
    failureCode(() =>
      reorderSubset(current, { order: ['e', 'b'], expected: { order: ['a', 'b', 'c', 'e', 'd'] } }),
    ),
  ).toBe('Conflict')

  expect(failureCode(() => moveWithinOrder(current, { ids: ['b'], before: 'missing' }))).toBe(
    'InvalidReference',
  )
  expect(current).toEqual(['a', 'b', 'c', 'd', 'e'])
})
