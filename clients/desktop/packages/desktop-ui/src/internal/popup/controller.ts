import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom'
import type { Placement, VirtualElement } from '@floating-ui/dom'
import { createEffect, createSignal, onSettled } from 'solid-js'
import type { Accessor } from 'solid-js'
import { watchPopupDismissal } from './dismissal'

/** Preferred popup side and optional alignment, with centered sides as the default alignment. */
export type PopupPlacement = Placement

/**
 * Connects native popup visibility, dismissal and collision-aware placement within the current
 * Solid owner.
 *
 * The surface is owned by this mount. Anchor bindings follow the current mounted trigger while
 * the popup is open.
 */
export function createPopup(options: {
  element: Accessor<HTMLElement>
  /** Returns the interaction anchor used for native popover ancestry and focus restoration. */
  anchor: Accessor<HTMLElement | undefined>
  /**
   * Returns a geometry reference when positioning should use a different element from the
   * interaction anchor.
   */
  reference?: Accessor<HTMLElement> | undefined

  open: Accessor<boolean>
  change: (open: boolean) => void
  /** Requests dismissal before hiding a popup rendered in manual top-layer mode. */
  controlled?: Accessor<boolean>

  placement?: (anchor: HTMLElement) => PopupPlacement
  /** Reads an optional pointer anchor in viewport CSS pixels. */
  point?: Accessor<{ x: number; y: number } | undefined>
  matchWidth?: boolean
  restoreFocus?: boolean
}): void {
  const [revision, refresh] = createSignal(0)
  let source: HTMLElement | undefined

  function requestClose(restoreFocus: boolean) {
    options.change(false)
    if (restoreFocus && options.restoreFocus !== false) {
      queueMicrotask(() => {
        const anchor = options.anchor()
        if (!options.open() && anchor?.isConnected) {
          anchor.focus()
        }
      })
    }
  }

  const escape = (event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.key !== 'Escape' ||
      !options.element().matches(':popover-open')
    ) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    requestClose(true)
  }

  onSettled(() => {
    const node = options.element()
    let lastHighlight: HTMLElement | null = null

    // Capture the hovered row while the closing popup is still laid out.
    const beforeToggle = (event: ToggleEvent) => {
      lastHighlight?.removeAttribute('data-exit-highlight')
      lastHighlight = null
      if (event.newState !== 'closed') {
        return
      }

      const row =
        node.querySelector<HTMLElement>('[data-option-highlight]:hover') ??
        node.querySelector<HTMLElement>('[data-option-highlight~="focus"]:focus-visible')
      if (row?.closest('[popover]') === node) {
        row.setAttribute('data-exit-highlight', '')
        lastHighlight = row
      }
    }

    // Adopt native dismissal after the browser finishes hiding its top-layer surface.
    const toggle = (event: ToggleEvent) => {
      if (event.newState === 'closed' && options.open() && !node.matches(':popover-open')) {
        options.change(false)
        queueMicrotask(() => {
          if (options.controlled?.() && options.open()) {
            refresh((value) => value + 1)
          }
        })
      }
    }

    node.dataset.uiPopup = ''
    node.addEventListener('beforetoggle', beforeToggle)
    node.addEventListener('toggle', toggle)
    node.addEventListener('keydown', escape)
    return () => {
      node.removeEventListener('beforetoggle', beforeToggle)
      node.removeEventListener('toggle', toggle)
      node.removeEventListener('keydown', escape)
      if (node.matches(':popover-open')) {
        node.hidePopover()
      }
    }
  })

  createEffect(
    () => {
      revision()
      const anchor = options.anchor()
      if (!options.open() || !anchor) {
        return undefined
      }
      const point = options.point?.()
      const reference: HTMLElement | VirtualElement = point
        ? {
            contextElement: anchor,
            getBoundingClientRect: () => new DOMRect(point.x, point.y, 0, 0),
          }
        : (options.reference?.() ?? anchor)
      return {
        anchor,
        reference,
        point,
        placement: options.placement?.(anchor) ?? 'bottom-start',
        controlled: options.controlled?.(),
        matchWidth: options.matchWidth,
      }
    },
    (position) => {
      const node = options.element()
      const shown = node.matches(':popover-open')
      if (!position) {
        if (shown) {
          node.hidePopover()
        }
        source = undefined
        return
      }

      const { anchor, reference, point, placement, controlled, matchWidth } = position
      if (!shown || source !== anchor) {
        let focused: HTMLElement | undefined
        if (shown) {
          // The browser associates a popover with its source when it enters the top layer.
          const current = node.ownerDocument.activeElement
          if (current instanceof HTMLElement && node.contains(current)) {
            focused = current
          }
          node.hidePopover()
        }

        if (getComputedStyle(node).display === 'none') {
          node.setAttribute('data-measuring', '')
        }
        node.showPopover({ source: anchor })
        if (!node.matches(':popover-open')) {
          return
        }
        source = anchor
        focused?.focus({ preventScroll: true })
      }

      let active = true
      // Floating UI can resolve after this positioning subscription has ended.
      const update = () => {
        void computePosition(reference, node, {
          strategy: 'fixed',
          placement,
          middleware: [
            offset(point ? 0 : 4),
            flip({ padding: 8 }),
            shift({ padding: 8 }),
            size({
              padding: 8,
              apply({ availableWidth, availableHeight, rects }) {
                if (active) {
                  node.style.setProperty('--popup-width', `${rects.reference.width}px`)
                  node.style.setProperty(
                    '--popup-available-width',
                    `${Math.max(0, availableWidth)}px`,
                  )
                  node.style.setProperty(
                    '--popup-available-height',
                    `${Math.max(0, availableHeight)}px`,
                  )
                  if (matchWidth) {
                    node.style.minWidth = `${Math.min(rects.reference.width, Math.max(0, availableWidth))}px`
                  }
                }
              },
            }),
          ],
        }).then(({ x, y, placement: resolved }) => {
          if (active) {
            const ratio = node.ownerDocument.defaultView!.devicePixelRatio
            node.style.left = `${Math.round(x * ratio) / ratio}px`
            node.style.top = `${Math.round(y * ratio) / ratio}px`
            node.dataset.placement = resolved
            node.removeAttribute('data-measuring')
          }
        })
      }
      anchor.addEventListener('keydown', escape)
      const stop = autoUpdate(reference, node, update)
      const stopDismissal = controlled ? watchPopupDismissal(node, anchor, requestClose) : undefined

      return () => {
        active = false
        stop()
        anchor.removeEventListener('keydown', escape)
        stopDismissal?.()
      }
    },
  )
}
