/** @fileoverview Native top-layer presentation with collision-aware Floating UI positioning. */

import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom'
import type { VirtualElement } from '@floating-ui/dom'
import { createEffect, onCleanup, onMount } from 'solid-js'
import type { Accessor } from 'solid-js'

/** Placement uses physical viewport edges; start/end follow the anchor's text direction. */
export type PopupPlacement =
  'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'right-start' | 'left-start'

/** Native modal scope follows DOM ancestry. Position observers live only while open. */
export function createPopup(options: {
  element: Accessor<HTMLElement>
  anchor: Accessor<HTMLElement>
  reference?: Accessor<HTMLElement> | undefined

  open: Accessor<boolean>
  change: (open: boolean) => void

  placement?: Accessor<PopupPlacement>
  point?: Accessor<{ x: number; y: number } | undefined>
  matchWidth?: boolean
  restoreFocus?: boolean
}): void {
  onMount(() => {
    const node = options.element()
    node.dataset.uiPopup = ''
    const anchor = options.anchor()

    let lastHighlight: HTMLElement | null = null
    const toggle = (event: ToggleEvent) => {
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
      if (options.open()) {
        options.change(false)
      }
    }
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
      options.change(false)
      if (options.restoreFocus !== false && anchor.isConnected) {
        anchor.focus()
      }
    }

    node.addEventListener('beforetoggle', toggle)
    node.addEventListener('keydown', escape)
    anchor.addEventListener('keydown', escape)

    createEffect(() => {
      if (!options.open()) {
        if (node.matches(':popover-open')) {
          node.hidePopover()
        }
        return
      }

      const point = options.point?.()
      const placement = options.placement?.() ?? 'bottom-start'
      const reference: HTMLElement | VirtualElement = point
        ? {
            contextElement: anchor,
            getBoundingClientRect: () => new DOMRect(point.x, point.y, 0, 0),
          }
        : (options.reference?.() ?? anchor)
      let active = true
      if (getComputedStyle(node).display === 'none') {
        node.setAttribute('data-measuring', '')
      }
      node.showPopover({ source: anchor })

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
      const stop = autoUpdate(reference, node, update)
      onCleanup(() => {
        active = false
        stop()
      })
    })

    onCleanup(() => {
      node.removeEventListener('beforetoggle', toggle)
      node.removeEventListener('keydown', escape)
      anchor.removeEventListener('keydown', escape)
      if (node.matches(':popover-open')) {
        node.hidePopover()
      }
    })
  })
}
