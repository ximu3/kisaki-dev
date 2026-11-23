import { createEffect, createMemo, createSignal, untrack } from 'solid-js'
import type { Accessor } from 'solid-js'

/** Keeps the last visible sample throughout the exit transition. */
export function displayedWhileOpen<T>(open: Accessor<boolean>, value: Accessor<T>): Accessor<T> {
  const initial = untrack(value)
  return createMemo<T>((previous = initial) => (open() ? value() : previous))
}

/** Remains present through the native exit transition. Reopening supersedes a pending close. */
export function createPresentation(
  open: Accessor<boolean>,
  element: Accessor<HTMLElement | undefined>,
): Accessor<boolean> {
  const [retained, retain] = createSignal(untrack(open))

  createEffect(open, (next) => {
    if (next) {
      retain(true)
      return
    }
    if (!untrack(retained)) {
      return
    }

    let superseded = false

    // Native styles settle before the closing transition can be queried.
    queueMicrotask(() => {
      if (superseded) {
        return
      }
      const exit = element()
        ?.getAnimations()
        .find((item) => item instanceof CSSTransition && item.transitionProperty === 'display')
      const finish = () => {
        if (!superseded) {
          retain(false)
        }
      }
      if (exit) {
        void exit.finished.then(finish, finish)
      } else {
        finish()
      }
    })

    return () => {
      superseded = true
    }
  })

  return createMemo(() => open() || retained())
}
