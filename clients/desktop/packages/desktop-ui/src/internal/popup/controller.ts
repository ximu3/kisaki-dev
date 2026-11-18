/** @fileoverview Native top-layer presentation with collision-aware Floating UI positioning. */

import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom'
import type { Placement, VirtualElement } from '@floating-ui/dom'
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
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
  /** Returns the mounted native popover element. */
  element: Accessor<HTMLElement>
  /** Returns the interaction anchor used for native popover ancestry and focus restoration. */
  anchor: Accessor<HTMLElement | undefined>
  /**
   * Returns a geometry reference when positioning should use a different element from the
   * interaction anchor.
   */
  reference?: Accessor<HTMLElement> | undefined

  /** Reads the requested open state from the popup owner. */
  open: Accessor<boolean>
  /** Reports a dismissal request to the popup owner. */
  change: (open: boolean) => void
  /** Requests dismissal before hiding a popup rendered in manual top-layer mode. */
  controlled?: Accessor<boolean>

  /** Reads the preferred placement before collision adjustment. */
  placement?: (anchor: HTMLElement) => PopupPlacement
  /** Reads an optional pointer anchor in viewport CSS pixels. */
  point?: Accessor<{ x: number; y: number } | undefined>
  matchWidth?: boolean
  restoreFocus?: boolean
}): void {
  onMount(() => {
    const node = options.element()
    node.dataset.uiPopup = ''

    const [revision, refresh] = createSignal(0)
    let source: HTMLElement | undefined
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
        if (options.controlled?.() && options.open()) {
          refresh((value) => value + 1)
        }
      }
    }

    function requestClose(restoreFocus: boolean) {
      options.change(false)
      const anchor = options.anchor()
      if (
        restoreFocus &&
        !options.open() &&
        options.restoreFocus !== false &&
        anchor?.isConnected
      ) {
        anchor.focus()
      }
    }

    /**
     * Requests closing this open popup and returns focus to its connected anchor when restoration
     * is enabled.
     */
    const escape = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.key !== 'Escape' ||
        !node.matches(':popover-open')
      ) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      requestClose(true)
    }

    node.addEventListener('beforetoggle', beforeToggle)
    node.addEventListener('toggle', toggle)
    node.addEventListener('keydown', escape)

    createEffect(() => {
      revision()
      const anchor = options.anchor()
      const shown = node.matches(':popover-open')
      if (!options.open() || !anchor) {
        if (shown) {
          node.hidePopover()
        }
        source = undefined
        return
      }

      const point = options.point?.()
      const placement = options.placement?.(anchor) ?? 'bottom-start'
      const reference: HTMLElement | VirtualElement = point
        ? {
            contextElement: anchor,
            /** Returns a zero-size viewport rectangle at the supplied pointer position. */
            getBoundingClientRect: () => new DOMRect(point.x, point.y, 0, 0),
          }
        : (options.reference?.() ?? anchor)
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
      /**
       * Computes collision-adjusted geometry and applies it while the current positioning lifetime
       * remains active.
       */
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
              /**
               * Applies available positioning bounds only to the currently active popup element.
               */
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
                  if (options.matchWidth) {
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
      const stopDismissal = options.controlled?.()
        ? watchPopupDismissal(node, anchor, requestClose)
        : undefined
      onCleanup(() => {
        active = false
        stop()
        anchor.removeEventListener('keydown', escape)
        stopDismissal?.()
      })
    })

    onCleanup(() => {
      node.removeEventListener('beforetoggle', beforeToggle)
      node.removeEventListener('toggle', toggle)
      node.removeEventListener('keydown', escape)
      if (node.matches(':popover-open')) {
        node.hidePopover()
      }
    })
  })
}
