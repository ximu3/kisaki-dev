import type { PageRef } from '@kisaki3/desktop-contracts/ui'
import { moveListItems, type ListMove } from '@kisaki3/desktop-ui/list'

export function pageKey(ref: PageRef) {
  return JSON.stringify(
    ref.type === 'native' ? [ref.type, ref.id] : [ref.type, ref.extensionId, ref.pageId],
  )
}

export function arrangePages<T extends { ref: PageRef }>(
  pages: readonly T[],
  order: readonly PageRef[],
) {
  const remaining = new Map(pages.map((page) => [pageKey(page.ref), page]))
  const slots = [...order]
  const visible: T[] = []
  for (const ref of order) {
    const key = pageKey(ref)
    const page = remaining.get(key)
    if (page) {
      visible.push(page)
      remaining.delete(key)
    }
  }
  for (const page of remaining.values()) {
    visible.push(page)
    slots.push(page.ref)
  }
  return { slots, visible }
}

export function movePages(order: ReturnType<typeof arrangePages>, move: ListMove) {
  const pages = new Map(order.visible.map((page) => [pageKey(page.ref), page.ref]))
  const ids = [...pages.keys()]
  const next = moveListItems(ids, move)
  if (next === ids) {
    return
  }

  let slot = 0
  return order.slots.map((ref) => (pages.has(pageKey(ref)) ? pages.get(next[slot++]!)! : ref))
}
