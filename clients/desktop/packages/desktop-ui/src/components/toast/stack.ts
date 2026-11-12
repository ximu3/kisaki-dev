/** @fileoverview Animates surviving cards between their actual positions after a queue change. */

import { onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'

/**
 * Creates a Solid-owned coordinator that animates card positions around batched queue mutations.
 *
 * Reduced motion cancels active movement, and owner cleanup releases animations and the preference
 * listener.
 */
export function createStackMotion(track: Accessor<HTMLElement | undefined>) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const animations = new Map<HTMLElement, Animation>()
  let previous: Map<HTMLElement, DOMRect> | undefined

  /** Discards pending geometry and cancels every active stack-position animation. */
  const stop = () => {
    previous = undefined
    for (const animation of animations.values()) {
      animation.cancel()
    }
    animations.clear()
  }
  /** Stops stack motion when the user enables reduced motion. */
  const preferenceChanged = () => {
    if (reduced.matches) {
      stop()
    }
  }
  reduced.addEventListener('change', preferenceChanged)
  onCleanup(() => {
    reduced.removeEventListener('change', preferenceChanged)
    stop()
  })

  return (change: () => void): void => {
    const stack = track()
    if (previous || !stack?.parentElement?.matches(':popover-open') || reduced.matches) {
      change()
      return
    }
    const style = getComputedStyle(stack)
    const duration = Number(style.getPropertyValue('--kui-toast-stack-ms'))
    if (!(duration > 0)) {
      change()
      return
    }

    const before = new Map<HTMLElement, DOMRect>()
    for (const card of stack.querySelectorAll<HTMLElement>(
      ':scope > [data-type]:not([data-arriving])',
    )) {
      before.set(card, card.getBoundingClientRect())
    }
    previous = before
    // Solid may batch several insertions, updates or releases into one layout.
    /**
     * Measures the updated stack and animates cards from their last painted positions after batched
     * changes settle.
     */
    const moveCards = () => {
      if (previous !== before) {
        return
      }
      previous = undefined
      const moves: [HTMLElement, number][] = []
      let tailOffset = 0
      for (const card of stack.querySelectorAll<HTMLElement>(':scope > [data-type]')) {
        const old = before.get(card)
        if (!old) {
          // New siblings begin after the last painted card, including when the queue is already moving.
          if (tailOffset) {
            moves.push([card, tailOffset])
          }
          continue
        }
        const rect = card.getBoundingClientRect()
        const delta = old.top - rect.top
        const matrix = getComputedStyle(card).transform
        const offset = matrix === 'none' ? 0 : new DOMMatrixReadOnly(matrix).m42
        tailOffset = offset + old.bottom - rect.bottom
        if (delta) {
          moves.push([card, offset + delta])
        }
      }

      // The card's own arrival and exit use translate; the stack owns its transform.
      for (const [card, offset] of moves) {
        animations.get(card)?.cancel()
        const animation = card.animate(
          [{ transform: `translateY(${offset}px)` }, { transform: 'none' }],
          { duration, easing: 'ease-in-out' },
        )
        animations.set(card, animation)
        /**
         * Removes a settled animation record only if it is still the card's current stack motion.
         */
        const finish = () => {
          if (animations.get(card) === animation) {
            animations.delete(card)
          }
        }
        void animation.finished.then(finish, finish)
      }
    }
    try {
      change()
    } finally {
      queueMicrotask(moveCards)
    }
  }
}
