import { isDeepStrictEqual } from 'node:util'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { ReorderInput, MoveInput } from '@kisaki3/desktop-contracts/library'

export function orderedIds(current: readonly string[], input: ReorderInput | MoveInput) {
  const members = new Set(current)
  const selected = new Set('order' in input ? input.order : input.ids)
  if ([...selected].some((id) => !members.has(id))) {
    throw new DesktopError('Conflict', 'A selected item no longer belongs to the ordered list')
  }
  if ('order' in input) {
    if (!isDeepStrictEqual(current, input.expected.order)) {
      throw new DesktopError('Conflict', 'The order changed')
    }
    let slot = 0
    return current.map((id) => (selected.has(id) ? input.order[slot++]! : id))
  }
  const result = current.filter((id) => !selected.has(id))
  const index = input.before === null ? result.length : result.indexOf(input.before)
  if (index < 0) {
    throw new DesktopError('Conflict', 'The neighbouring item changed')
  }
  result.splice(index, 0, ...input.ids)
  return result
}
