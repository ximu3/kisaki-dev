/** @fileoverview Retains closing content and its displayed values through native exit presentation. */

import { createEffect, createMemo, createSignal, untrack } from 'solid-js'
import type { Accessor } from 'solid-js'

/**
 * Tracks a value while open and retains its last displayed sample while closed, including exit
 * presentation.
 */
export function displayedWhileOpen<T>(open: Accessor<boolean>, value: Accessor<T>): Accessor<T> {
  const initial = untrack(value)
  return createMemo<T>((previous = initial) => (open() ? value() : previous))
}

/**
 * Creates Solid-owned presence state that remains true through the native display exit transition.
 *
 * A new opening invalidates the previous close's pending release.
 */
export function createPresentation(
  open: Accessor<boolean>,
  element: Accessor<HTMLElement | undefined>,
): Accessor<boolean> {
  /** Presence state that keeps closing content mounted until its transition ends. */
  const [retained, retain] = createSignal(untrack(open))

  createEffect(open, (next) => {
    if (next) {
      retain(true)
      return
    }
    if (!untrack(retained)) {
      return
    }

    // The close and native styles settle before inspecting the actual outgoing transition.
    let current = true

    queueMicrotask(() => {
      if (!current) {
        return
      }
      const exit = element()
        ?.getAnimations()
        .find((item) => item instanceof CSSTransition && item.transitionProperty === 'display')
      /** Clears retained presence after exit settles if this close is still current. */
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

    return () => {
      current = false
    }
  })

  return createMemo(() => open() || retained())
}
