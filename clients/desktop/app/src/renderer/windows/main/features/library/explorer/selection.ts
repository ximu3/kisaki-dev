import { createSignal } from 'solid-js'
import type {
  EntryGroupKey,
  EntryQuery,
  EntryRef,
  EntrySelection,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'

interface Instance {
  ref: EntryRef
  group: EntryGroupKey
}
export function createExplorerSelection(api: MainClient, query: () => EntryQuery) {
  const [items, setItems] = createSignal<ReadonlyMap<string, EntryRef>>(new Map())
  let anchor: Instance | undefined
  let generation = 0

  function single(instance: Instance) {
    generation++
    anchor = instance
    setItems(new Map([[instance.ref.id, instance.ref]]))
  }
  function toggle(instance: Instance) {
    generation++
    anchor = instance
    setItems((previous) => {
      const next = new Map(previous)
      if (next.has(instance.ref.id)) {
        next.delete(instance.ref.id)
      } else {
        next.set(instance.ref.id, instance.ref)
      }
      return next
    })
  }
  async function select(selection: EntrySelection) {
    const token = ++generation
    const source = query()
    const refs = await api.call('library.entries.selectRefs', source, selection)
    if (token === generation && source === query()) {
      setItems(new Map(refs.map((ref) => [ref.id, ref])))
    }
  }
  function clear() {
    generation++
    anchor = undefined
    setItems(new Map<string, EntryRef>())
  }
  function range(end: Instance, expandedGroups: readonly EntryGroupKey[]) {
    if (!anchor) {
      single(end)
      return Promise.resolve()
    }
    return select({ type: 'groupRange', anchor, focus: end, expandedGroups })
  }
  return { items, single, toggle, clear, range, all: () => select({ type: 'all' }) }
}
