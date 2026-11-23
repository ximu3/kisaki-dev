/** @fileoverview Local controlled values and native reset synchronization. */

import { createMemo, createSignal, onSettled, untrack } from 'solid-js'
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
  /** Locally owned fallback value initialized once without capturing reactive dependencies. */
  const [local, setLocal] = createSignal<T>(() => untrack(initial))
  const controlled = createMemo(value)
  const current = () => {
    const supplied = controlled()
    return supplied === undefined ? local() : supplied
  }

  return [
    current,
    (next) => {
      // A native event may call this without a Solid owner. Read the already owned prop value.
      if (Object.is(untrack(current), next)) {
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
 * Runs an accepted reset after dispatch. Editors can flush it before processing a later change
 * in the same turn. A reset currently being dispatched can still be cancelled.
 */
export function onFormReset(
  element: Accessor<{ form: HTMLFormElement | null; ownerDocument: Document }>,
  reset: () => void,
): () => void {
  const pending = new Map<Event, ReturnType<typeof setTimeout>>()

  /** Delivers completed resets in event order, before a later edit can be overwritten. */
  function flush() {
    for (const [event, timer] of pending) {
      if (event.eventPhase !== Event.NONE) {
        continue
      }
      clearTimeout(timer)
      pending.delete(event)
      if (!event.defaultPrevented) {
        reset()
      }
    }
  }

  onSettled(() => {
    const document = element().ownerDocument
    /** Waits for the native default action and for listeners that can cancel it. */
    const listener = (event: Event) => {
      if (event.target === element().form) {
        pending.set(event, setTimeout(flush, 0))
      }
    }
    document.addEventListener('reset', listener, true)
    return () => {
      for (const timer of pending.values()) {
        clearTimeout(timer)
      }
      pending.clear()
      document.removeEventListener('reset', listener, true)
    }
  })
  return flush
}
