/** @fileoverview Local controlled values and native reset synchronization. */

import { createSignal, onCleanup, onMount, untrack } from 'solid-js'
import type { Accessor } from 'solid-js'

/**
 * Creates a controlled-or-local value accessor and change requester from a captured initial value.
 *
 * A defined external value remains authoritative. Requests equal to the exposed value by Object.is
 * produce no notification.
 */
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

/**
 * Observes accepted resets for the element's current native form owner, including external form
 * associations.
 *
 * Callbacks run after event dispatch; cancelled resets do nothing. Owner cleanup cancels pending
 * callbacks and removes the listener.
 */
export function onFormReset(
  element: Accessor<{ form: HTMLFormElement | null; ownerDocument: Document }>,
  reset: () => void,
): void {
  onMount(() => {
    const document = element().ownerDocument
    const pending = new Set<ReturnType<typeof setTimeout>>()

    /** Defers a matching form reset until dispatch completes so later listeners can cancel it. */
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
