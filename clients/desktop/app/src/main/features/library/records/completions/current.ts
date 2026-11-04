/** @fileoverview Coalesces equivalent record-current intents while retaining conflict baselines. */

import type { NonEmptyArray } from '@kisaki3/desktop-contracts/operations'
import type { CompletionCreateItem } from '@kisaki3/desktop-contracts/library'
import { parseCompletionCreateMany } from '@kisaki3/desktop-contracts/library'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

/** Coalesce equivalent current-completion intents by first work appearance while preserving any supplied baseline. */
export function parseRecordCurrentMany(input: unknown): NonEmptyArray<CompletionCreateItem> {
  const items = parseCompletionCreateMany(input)
  const result = new Map<string, CompletionCreateItem>()
  for (const item of items) {
    const key = JSON.stringify([item.work.type, item.work.id])
    const previous = result.get(key)
    if (
      previous &&
      (JSON.stringify(previous.completedDate) !== JSON.stringify(item.completedDate) ||
        previous.note !== item.note)
    ) {
      throw new DesktopError('InvalidInput', 'Conflicting completion actions for one work')
    }
    if (!previous || (!previous.expected && item.expected)) {
      result.set(key, item)
    }
  }

  const values = [...result.values()]
  return [values[0]!, ...values.slice(1)]
}
