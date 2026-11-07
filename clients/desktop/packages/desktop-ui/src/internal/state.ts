/** @fileoverview Local controlled values and native reset synchronization. */

import { createSignal, onCleanup, onMount, untrack } from 'solid-js'
import type { Accessor } from 'solid-js'

/** One value owner: defined value is controlled, otherwise the captured default initializes local state. */
export function createValue<T>(
  value: Accessor<T | undefined>,
  initial: Accessor<T>,
  changed: (value: T) => void,
): readonly [Accessor<T>, (value: T) => void] {
  const [local, setLocal] = createSignal<T>(untrack(initial))

  return [
    () => (value() === undefined ? local() : value()!),
    (next) => {
      if (
        Object.is(
          untrack(() => (value() === undefined ? local() : value())),
          next,
        )
      ) {
        return
      }

      setLocal(() => next)
      changed(next)
    },
  ]
}

/** Follow successful native resets, including external form ownership; canceled resets do nothing. */
export function onFormReset(
  element: Accessor<{ form: HTMLFormElement | null; ownerDocument: Document }>,
  reset: () => void,
): void {
  onMount(() => {
    const document = element().ownerDocument
    const pending = new Set<ReturnType<typeof setTimeout>>()

    const listener = (event: Event) => {
      if (event.target !== element().form) {
        return
      }

      // Native dispatch can checkpoint microtasks between listeners; wait for the completed event.
      const timer = setTimeout(() => {
        pending.delete(timer)
        if (!event.defaultPrevented) {
          reset()
        }
      }, 0)
      pending.add(timer)
    }

    document.addEventListener('reset', listener, true)
    onCleanup(() => {
      for (const timer of pending) {
        clearTimeout(timer)
      }
      document.removeEventListener('reset', listener, true)
    })
  })
}
