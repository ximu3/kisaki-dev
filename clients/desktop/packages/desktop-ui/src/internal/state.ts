import { createMemo, createSignal, flush, onSettled, untrack, type Accessor } from 'solid-js'

export type ValueChange<T> = (update: T | ((previous: T) => T)) => void

export function createValue<T>(
  value: Accessor<T | undefined>,
  initial: Accessor<T>,
  changed: (value: T) => void,
): readonly [Accessor<T>, ValueChange<T>] {
  const [local, setLocal] = createSignal<T>(() => untrack(initial))
  const controlled = createMemo(value)
  const current = () => {
    const supplied = controlled()
    return supplied === undefined ? local() : supplied
  }

  let requested: { value: T } | undefined

  const change: ValueChange<T> = (update) => {
    if (requested && typeof update === 'function' && untrack(controlled) !== undefined) {
      // A second toggle must see whether the host adopted the first request.
      flush()
    }
    const supplied = untrack(controlled)
    const previous = requested && supplied === undefined ? requested.value : untrack(current)
    const next = typeof update === 'function' ? (update as (previous: T) => T)(previous) : update
    if (Object.is(previous, next) && (!requested || Object.is(requested.value, next))) {
      return
    }

    // Compose requests within a Solid update. The host supplies the next settled value.
    if (!requested) {
      onSettled(() => {
        requested = undefined
      })
    }
    requested = { value: next }
    if (supplied === undefined) {
      setLocal(() => next)
    }
    changed(next)
  }
  return [current, change]
}

export function commitNativeValue<Args extends unknown[]>(
  change: (...args: Args) => void,
  sync: () => void,
) {
  return (...args: Args) => {
    change(...args)
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
