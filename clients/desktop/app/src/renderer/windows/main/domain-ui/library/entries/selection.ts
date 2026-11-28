import { createContext, createEffect, createSignal, onCleanup, useContext } from 'solid-js'
import type {
  EntryGroupKey,
  EntryQuery,
  EntryRef,
  EntrySelection,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'
import { reportError } from '../../../../../infrastructure/notifications'

export const LibraryVisibility = createContext<() => boolean | undefined>(() => undefined)

interface Instance {
  ref: EntryRef
  group?: EntryGroupKey
}
export function createEntrySelection(
  api: MainClient,
  query: () => EntryQuery,
  initial: readonly EntryRef[] = [],
) {
  const [items, setItems] = createSignal<ReadonlyMap<string, EntryRef>>(
    new Map(initial.map((ref) => [ref.id, ref])),
  )
  let anchor: Instance | undefined
  let generation = 0
  const visibility = useContext(LibraryVisibility)
  let previousVisibility = visibility()
  let previousScope = scopeKey()

  function scopeKey() {
    const { scope, search, rules } = query()
    return JSON.stringify([scope, search, rules])
  }
  createEffect(
    () => ({ scope: scopeKey(), visible: visibility() }),
    ({ scope, visible }) => {
      if (
        scope !== previousScope ||
        (previousVisibility !== undefined &&
          visible !== undefined &&
          visible !== previousVisibility)
      ) {
        clear()
      }
      previousScope = scope
      if (visible !== undefined) {
        previousVisibility = visible
      }
    },
  )
  onCleanup(() => {
    generation++
  })

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
  function range(end: Instance, expandedGroups?: readonly EntryGroupKey[]) {
    if (!anchor) {
      single(end)
      return Promise.resolve()
    }
    if (anchor.group && end.group && expandedGroups) {
      return select({
        type: 'groupRange',
        anchor: { ref: anchor.ref, group: anchor.group },
        focus: { ref: end.ref, group: end.group },
        expandedGroups,
      })
    }
    return select({ type: 'range', anchor: anchor.ref, focus: end.ref })
  }
  function context(instance: Instance) {
    if (items().has(instance.ref.id)) {
      return [...items().values()]
    }
    single(instance)
    return [instance.ref]
  }
  function activate(e: MouseEvent, instance: Instance, expanded?: readonly EntryGroupKey[]) {
    if (e.shiftKey) {
      void range(instance, expanded).catch(reportError)
    } else if (e.metaKey || e.ctrlKey) {
      toggle(instance)
    } else {
      single(instance)
      return true
    }
    return false
  }
  function keys(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      clear()
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
      void select({ type: 'all' }).catch(reportError)
    } else {
      return
    }
    e.preventDefault()
    e.stopPropagation()
  }
  return { items, toggle, clear, range, context, activate, keys }
}
