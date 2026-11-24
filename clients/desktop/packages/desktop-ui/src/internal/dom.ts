import { createSignal, onCleanup } from 'solid-js'

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

export function classes(...values: (string | undefined)[]): string {
  return values.filter(Boolean).join(' ')
}

export function callHandler<E extends Event>(
  handler:
    | ((event: E) => void)
    | {
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
