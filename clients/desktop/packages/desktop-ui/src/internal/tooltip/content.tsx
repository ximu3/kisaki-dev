/** @fileoverview A read-only tooltip surface shares native positioning and reading state. */

import { onCleanup, onMount, splitProps } from 'solid-js'
import type { Accessor, JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../dom'
import { createPopup } from '../popup/controller'
import type { PopupPlacement } from '../popup/controller'
import type { createTooltip } from './controller'
import frame from '../popup/surface.module.css'
import styles from './styles.module.css'

/**
 * Read-only explanation content with an anchor, shared reading controller and optional placement.
 */
interface TooltipSurfaceProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Returns the element whose supplemental explanation is positioned by this surface. */
  anchor: Accessor<HTMLElement>
  reading: ReturnType<typeof createTooltip>
  placement?: PopupPlacement
}

/**
 * Renders a native hint popover tied to the shared hover and focus reading lifetime.
 *
 * Its document connection is released with the surface, and closing does not move keyboard focus.
 */
export function TooltipSurface(props: TooltipSurfaceProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'anchor',
    'reading',
    'placement',
    'class',
    'children',
    'ref',
    'onPointerEnter',
    'onPointerLeave',
  ])
  let content!: HTMLDivElement
  onMount(() => onCleanup(local.reading.connect(content.ownerDocument)))

  createPopup({
    /** Reads the currently mounted tooltip surface. */
    element: () => content,
    anchor: local.anchor,
    open: local.reading.open,

    /** Dismisses the tooltip through its reading-state owner when closure is requested. */
    change: (open) => {
      if (!open) {
        local.reading.dismiss()
      }
    },

    /** Reads the tooltip's preferred placement with the shared default. */
    placement: () => local.placement ?? 'bottom-start',
    restoreFocus: false,
  })

  return (
    <div
      {...rest}
      role="tooltip"
      data-tooltip-handoff={local.reading.handoff() || undefined}
      ref={(node) => {
        node.popover = 'hint'
        content = node
        assignRef(local.ref, node)
      }}
      class={classes(frame.anchor, styles.content, local.class)}
      onPointerEnter={(event) => {
        local.reading.hover('content', true)
        callHandler(local.onPointerEnter, event)
      }}
      onPointerLeave={(event) => {
        local.reading.hover('content', false)
        callHandler(local.onPointerLeave, event)
      }}
    >
      <div class={classes(frame.viewport, styles.text)}>{local.children}</div>
    </div>
  )
}
