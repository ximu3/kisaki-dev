/** @fileoverview Enabled-item navigation with actual DOM order and bounded typeahead lifetime. */

import { onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'

/**
 * Returns matching descendants with layout boxes that are neither disabled nor explicitly hidden,
 * in DOM order.
 */
export function focusableItems(container: HTMLElement, selector: string): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (item) =>
      !item.matches(':disabled,[aria-disabled="true"],[hidden]') &&
      item.getClientRects().length > 0,
  )
}

/**
 * Creates a Solid-owned handler for directional focus, Home and End, and timed prefix search.
 *
 * Targets follow current DOM order and writing direction; owner cleanup clears the search timer.
 */
export function createFocusNavigation(
  root: Accessor<HTMLElement>,
  selector: string,
  orientation: Accessor<'horizontal' | 'vertical'>,
  moved?: (item: HTMLElement) => void,
) {
  let search = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))

  return (event: KeyboardEvent) => {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const items = focusableItems(root(), selector)
    const current = items.indexOf(root().ownerDocument.activeElement as HTMLElement)
    const horizontal = orientation() === 'horizontal'
    const rtl = getComputedStyle(root()).direction === 'rtl'
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft'
    const next = horizontal ? forward : 'ArrowDown'
    const previous = horizontal ? backward : 'ArrowUp'

    let target: HTMLElement | undefined
    if (event.key === next) {
      target = items[(current + 1) % items.length]
    } else if (event.key === previous) {
      target = items[(current - 1 + items.length) % items.length]
    } else if (event.key === 'Home') {
      target = items[0]
    } else if (event.key === 'End') {
      target = items.at(-1)
    } else if (event.key.length === 1 && event.key !== ' ') {
      clearTimeout(timer)
      search += event.key.toLocaleLowerCase()
      timer = setTimeout(() => {
        search = ''
      }, 700)

      const prefix = [...search].every((character) => character === search[0]) ? search[0]! : search
      const ordered = [...items.slice(current + 1), ...items.slice(0, current + 1)]
      target = ordered.find((item) =>
        (item.getAttribute('aria-label') ?? item.textContent ?? '')
          .trim()
          .toLocaleLowerCase()
          .startsWith(prefix),
      )
    }

    if (target) {
      event.preventDefault()
      target.focus()
      moved?.(target)
    }
  }
}
