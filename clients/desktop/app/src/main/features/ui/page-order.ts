/** @fileoverview Reconciles saved navigation order with the currently available page directory. */

import type { PageRef } from '@kisaki3/desktop-contracts/ui'

/** Append newly registered pages without disturbing saved positions or removing unavailable ones. */
export function reconcilePageOrder(
  saved: readonly PageRef[],
  available: readonly PageRef[],
): readonly PageRef[] {
  const key = (page: PageRef) =>
    JSON.stringify(
      page.type === 'native' ? ['native', page.id] : ['extension', page.extensionId, page.pageId],
    )
  const seen = new Set(saved.map(key))
  return [
    ...saved,
    ...available.filter((page) => {
      const identity = key(page)
      if (seen.has(identity)) {
        return false
      }
      seen.add(identity)
      return true
    }),
  ]
}
