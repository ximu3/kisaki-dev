/** @fileoverview Shared DOM class, event and reference composition for native controls. */

/** Combine the component's local class with the caller's ordinary class. */
export function classes(...values: (string | undefined)[]): string {
  return values.filter(Boolean).join(' ')
}

/** Invoke either Solid event handler form without changing its event or bound data. */
export function callHandler<E extends Event>(
  handler:
    | ((event: E) => void)
    | { readonly 0: (data: unknown, event: E) => void; readonly 1: unknown }
    | undefined,
  event: E,
): void {
  if (typeof handler === 'function') {
    handler(event)
  } else if (handler) {
    handler[0](handler[1], event)
  }
}

/** Assign the mounted node to the caller's callback ref. JSX variable refs compile to callbacks. */
export function assignRef<T>(ref: T | ((value: T) => void) | undefined, value: T): void {
  if (typeof ref === 'function') {
    ;(ref as (value: T) => void)(value)
  }
}
