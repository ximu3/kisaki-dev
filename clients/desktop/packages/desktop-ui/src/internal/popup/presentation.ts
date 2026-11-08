/** @fileoverview Retain a closing surface and its displayed values through the native exit transition. */

import { createEffect, createMemo, createSignal, on, onCleanup, untrack } from 'solid-js'
import type { Accessor } from 'solid-js'

/** A closing picker paints the last open selection while its caller commits the new value. */
export function displayedWhileOpen<T>(open: Accessor<boolean>, value: Accessor<T>): Accessor<T> {
  return createMemo((previous) => (open() ? value() : previous), untrack(value))
}

export function createPresentation(
  open: Accessor<boolean>,
  element: Accessor<HTMLElement | undefined>,
): Accessor<boolean> {
  const [retained, retain] = createSignal(open())

  createEffect(
    on(open, (next) => {
      if (next) {
        retain(true)
        return
      }
      if (!retained()) {
        return
      }

      // The close and native styles settle before inspecting the actual outgoing transition.
      let current = true
      onCleanup(() => {
        current = false
      })
      queueMicrotask(() => {
        if (!current) {
          return
        }
        const exit = element()
          ?.getAnimations()
          .find((item) => item instanceof CSSTransition && item.transitionProperty === 'display')
        const finish = () => {
          if (current) {
            retain(false)
          }
        }
        if (exit) {
          void exit.finished.then(finish, finish)
        } else {
          finish()
        }
      })
    }),
  )

  return createMemo(() => open() || retained())
}
