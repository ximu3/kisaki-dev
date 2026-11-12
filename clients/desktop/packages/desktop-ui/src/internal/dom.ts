/** @fileoverview Shared DOM class, event and reference composition for native controls. */

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

/**
 * Passes a mounted value to the caller's callback ref.
 *
 * Compiled JSX variable refs use this callback form.
 */
export function assignRef<T>(ref: T | ((value: T) => void) | undefined, value: T): void {
  if (typeof ref === 'function') {
    ;(ref as (value: T) => void)(value)
  }
}
