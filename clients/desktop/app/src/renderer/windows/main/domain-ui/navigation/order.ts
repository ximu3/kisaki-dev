import type { PageRef } from '@kisaki3/desktop-contracts/ui'
import { moveListItems, type ListMove } from '@kisaki3/desktop-ui/list'

/** Uses saved positions first and appends newly available pages in catalog order. */
export function arrangePages<T extends { id: string }>(
  pages: readonly T[],
  order: readonly PageRef[],
) {
  const remaining = new Map(pages.map((page) => [page.id, page]))
  const slots = [...order]
  const visible: T[] = []
  for (const ref of order) {
    if (ref.type === 'native') {
      const page = remaining.get(ref.id)
      if (page) {
        visible.push(page)
        remaining.delete(ref.id)
      }
    }
  }
  for (const page of remaining.values()) {
    visible.push(page)
    slots.push({ type: 'native', id: page.id })
  }
  return { slots, visible }
}

/** Reorders available pages within their existing slots, retaining unavailable references in place. */
export function movePages(order: ReturnType<typeof arrangePages>, move: ListMove) {
  const ids = order.visible.map((page) => page.id)
  const next = moveListItems(ids, move)
  if (next === ids) {
    return
  }

  const available = new Set(ids)
  let slot = 0
  return order.slots.map((ref) =>
    ref.type === 'native' && available.has(ref.id)
      ? { type: 'native' as const, id: next[slot++]! }
      : ref,
  )
}
