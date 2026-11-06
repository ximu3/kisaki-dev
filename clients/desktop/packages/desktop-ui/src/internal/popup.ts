/** @fileoverview Native popover presentation, anchor positioning and instance-owned cleanup. */

import { createEffect, onCleanup, onMount } from 'solid-js'
import type { Accessor } from 'solid-js'

/** Placement uses physical viewport edges; start/end follow the anchor's text direction. */
export type PopupPlacement =
  'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'right-start' | 'left-start'

/** Native top-layer scope follows DOM ancestry. Position listeners live only while open. */
export function createPopup(options: {
  element: Accessor<HTMLElement>
  anchor: Accessor<HTMLElement>

  open: Accessor<boolean>
  change: (open: boolean) => void

  placement?: Accessor<PopupPlacement>
  point?: Accessor<{ x: number; y: number } | undefined>
  restoreFocus?: boolean
}): void {
  onMount(() => {
    const node = options.element()
    const document = node.ownerDocument
    const view = document.defaultView!

    const toggle = (event: ToggleEvent) => {
      if (event.newState === 'closed') {
        options.change(false)
      }
    }

    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !node.matches(':popover-open')) {
        return
      }

      // Native light dismissal cannot be canceled. Consume this Escape before a surrounding dialog.
      event.preventDefault()
      event.stopPropagation()
      node.hidePopover()
      options.change(false)
      if (options.restoreFocus !== false && options.anchor().isConnected) {
        options.anchor().focus()
      }
    }

    node.addEventListener('beforetoggle', toggle)
    node.addEventListener('keydown', escape)
    options.anchor().addEventListener('keydown', escape)

    createEffect(() => {
      if (!options.open()) {
        if (node.matches(':popover-open')) {
          node.hidePopover()
        }
        return
      }

      node.showPopover()
      const position = () => {
        const anchor = options.anchor()
        const rect = anchor.getBoundingClientRect()
        const point = options.point?.()
        const placement = options.placement?.() ?? 'bottom-start'
        const rtl = getComputedStyle(anchor).direction === 'rtl'
        const width = node.offsetWidth
        const height = node.offsetHeight

        let x = rect.left
        let y = rect.bottom + 4
        if (placement.endsWith('end') !== rtl) {
          x = rect.right - width
        }
        if (placement.startsWith('top')) {
          y = rect.top - height - 4
        }
        if (placement.startsWith('right')) {
          x = rect.right + 4
          y = rect.top
        }
        if (placement.startsWith('left')) {
          x = rect.left - width - 4
          y = rect.top
        }
        if (point) {
          x = point.x
          y = point.y
        }
        if (!point && y + height > view.innerHeight - 8 && rect.top - height - 4 >= 8) {
          y = rect.top - height - 4
        }

        node.style.left = `${Math.max(8, Math.min(x, view.innerWidth - width - 8))}px`
        node.style.top = `${Math.max(8, Math.min(y, view.innerHeight - height - 8))}px`
      }
      position()

      const resize = new ResizeObserver(position)
      resize.observe(node)
      resize.observe(options.anchor())
      view.addEventListener('resize', position)
      document.addEventListener('scroll', position, true)
      onCleanup(() => {
        resize.disconnect()
        view.removeEventListener('resize', position)
        document.removeEventListener('scroll', position, true)
      })
    })

    onCleanup(() => {
      node.removeEventListener('beforetoggle', toggle)
      node.removeEventListener('keydown', escape)
      options.anchor().removeEventListener('keydown', escape)
      if (node.matches(':popover-open')) {
        node.hidePopover()
      }
    })
  })
}
