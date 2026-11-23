import { createSignal, onCleanup } from 'solid-js'

/**
 * Shares a popup anchor across its triggers. Each trigger binds a ref in its own scope so its
 * disposal releases only the element it registered.
 */
export function createAnchor<T extends HTMLElement>() {
  const [anchor, setAnchor] = createSignal<T>()

  function bindAnchor() {
    let element: T
    onCleanup(() => setAnchor((current) => (current === element ? undefined : current)))
    return (node: T) => {
      element = node
      setAnchor(() => node)
    }
  }

  return [anchor, bindAnchor] as const
}

/** Combines nonempty local and caller class strings in their supplied order. */
export function classes(...values: (string | undefined)[]): string {
  return values.filter(Boolean).join(' ')
}

/** Invokes either Solid handler form with the original event and bound data. */
export function callHandler<E extends Event>(
  handler:
    | ((event: E) => void)
    | {
        /** Handles the event together with the tuple's bound data value. */
        readonly 0: (data: unknown, event: E) => void
        readonly 1: unknown
      }
    | undefined,
  event: E,
): void {
  if (typeof handler === 'function') {
    handler(event)
  } else if (handler) {
    handler[0](handler[1], event)
  }
}
