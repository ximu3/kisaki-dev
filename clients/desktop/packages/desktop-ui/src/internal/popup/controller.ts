/** @fileoverview Native top-layer presentation with collision-aware Floating UI positioning. */

import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom'
import type { Middleware, VirtualElement } from '@floating-ui/dom'
import { createEffect, onCleanup, onMount } from 'solid-js'
import type { Accessor } from 'solid-js'
import { applySurfaceOrigin, surfaceOrigin } from './origin'
import type { SurfaceOrigin } from './origin'

/** Placement uses physical viewport edges; start/end follow the anchor's text direction. */
export type PopupPlacement =
  'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'right-start' | 'left-start'

/** The animation and content reveal use the same resolved side, including flipped and point anchors. */
const origin: Middleware = {
  name: 'origin',
  fn({ x, y, rects }) {
    const { reference, floating } = rects
    const center = { x: reference.x + reference.width / 2, y: reference.y + reference.height / 2 }
    return { data: surfaceOrigin(center, { ...floating, x, y }) }
  },
}

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
    const toggle = (event: ToggleEvent) => {
      if (event.newState === 'closed' && options.open()) {
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
            origin,
          ],
        }).then(({ x, y, placement: resolved, middlewareData }) => {
          if (active) {
            node.style.left = `${x}px`
            node.style.top = `${y}px`
            node.dataset.placement = resolved
            applySurfaceOrigin(node, middlewareData.origin as SurfaceOrigin)
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
