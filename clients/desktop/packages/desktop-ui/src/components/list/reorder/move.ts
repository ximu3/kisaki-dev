/** Moves stable item identities together before or after an anchor in the same list. */
export interface ListMove {
  readonly ids: readonly string[]
  readonly targetId: string
  readonly edge: 'before' | 'after'
}

/** Applies a request within this order, preserving relative order and returning it for a no-op. */
export function moveListItems(order: readonly string[], move: ListMove): readonly string[] {
  const moving = new Set(move.ids)
  if (!moving.size || moving.has(move.targetId)) {
    return order
  }

  const items = order.filter((id) => moving.has(id))
  const remaining = order.filter((id) => !moving.has(id))
  const anchor = remaining.indexOf(move.targetId)
  if (items.length !== moving.size || anchor === -1) {
    return order
  }

  const next = remaining.toSpliced(anchor + Number(move.edge === 'after'), 0, ...items)
  return next.every((id, index) => id === order[index]) ? order : next
}
