import { createMemo, createSignal, flush, onSettled, untrack, type Accessor } from 'solid-js'

export function createValue<T>(
  value: Accessor<T | undefined>,
  initial: Accessor<T>,
  changed: (value: T) => void,
): readonly [Accessor<T>, (value: T) => void] {
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

      if (untrack(controlled) === undefined) {
        setLocal(() => next)
      }
      changed(next)
    },
  ]
}

export function commitNativeValue<T>(change: (next: T) => void, sync: () => void) {
  return (next: T) => {
    change(next)
    // Native event handlers can read or submit the adopted value in this turn.
    flush()
    sync()
  }
}

export function onFormReset(
  element: Accessor<{ form: HTMLFormElement | null; ownerDocument: Document }>,
  reset: () => void,
): () => void {
  const pending = new Map<Event, ReturnType<typeof setTimeout>>()

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
