import { createTypeahead, printableKey } from './typeahead'
import type { Accessor } from 'solid-js'

export function focusableItems(container: HTMLElement, selector: string): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (item) =>
      !item.matches(':disabled,[aria-disabled="true"],[hidden]') &&
      item.getClientRects().length > 0,
  )
}

export function createFocusNavigation(
  root: Accessor<HTMLElement>,
  selector: string,
  orientation: Accessor<'horizontal' | 'vertical'>,
  moved?: (item: HTMLElement) => void,
) {
  const typeahead = createTypeahead()

  return (event: KeyboardEvent) => {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const container = root()
    const items = focusableItems(container, selector)
    const focused = container.ownerDocument.activeElement
    const current = items.findIndex((item) => item === focused)
    const horizontal = orientation() === 'horizontal'
    const rtl = getComputedStyle(container).direction === 'rtl'
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft'
    const next = horizontal ? forward : 'ArrowDown'
    const previous = horizontal ? backward : 'ArrowUp'

    let target: HTMLElement | undefined
    if (event.key === next) {
      target = items[current + 1] ?? items[0]
    } else if (event.key === previous) {
      target = current > 0 ? items[current - 1] : items.at(-1)
    } else if (event.key === 'Home') {
      target = items[0]
    } else if (event.key === 'End') {
      target = items.at(-1)
    } else if (printableKey(event.key)) {
      const matches = typeahead(event.key, container)
      const ordered = [...items.slice(current + 1), ...items.slice(0, current + 1)]
      target = ordered.find((item) =>
        matches(item.getAttribute('aria-label') ?? item.textContent ?? ''),
      )
    }

    if (target) {
      event.preventDefault()
      target.focus()
      moved?.(target)
    }
  }
}
