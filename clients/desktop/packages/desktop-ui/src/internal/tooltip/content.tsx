/** @fileoverview A read-only tooltip surface shares native positioning and reading state. */

import { onSettled, omit } from 'solid-js'
import type { Accessor } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../dom'
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
  anchor: Accessor<HTMLElement | undefined>
  reading: ReturnType<typeof createTooltip>
  placement?: PopupPlacement
}

/**
 * Renders a native hint popover tied to the shared hover and focus reading lifetime.
 *
 * Its document connection is released with the surface, and closing does not move keyboard focus.
 */
export function TooltipSurface(props: TooltipSurfaceProps): JSX.Element {
  const rest = omit(
    props,
    'anchor',
    'reading',
    'placement',
    'class',
    'children',
    'ref',
    'onPointerEnter',
    'onPointerLeave',
  )
  let content!: HTMLDivElement
  onSettled(() => props.reading.connect(content.ownerDocument))

  createPopup({
    /** Reads the currently mounted tooltip surface. */
    element: () => content,
    anchor: props.anchor,
    open: props.reading.open,

    /** Dismisses the tooltip through its reading-state owner when closure is requested. */
    change: (open) => {
      if (!open) {
        props.reading.dismiss()
      }
    },

    /** Reads the tooltip's preferred placement with the shared default. */
    placement: () => props.placement ?? 'bottom-start',
    restoreFocus: false,
  })

  return (
    <div
      {...rest}
      role="tooltip"
      data-tooltip-handoff={props.reading.handoff() || undefined}
      ref={[
        (node) => {
          node.popover = 'hint'
          content = node
        },
        props.ref,
      ]}
      class={[frame.anchor, styles.content, props.class]}
      onPointerEnter={(event) => {
        props.reading.hover('content', true)
        callHandler(props.onPointerEnter, event)
      }}
      onPointerLeave={(event) => {
        props.reading.hover('content', false)
        callHandler(props.onPointerLeave, event)
      }}
    >
      <div class={[frame.viewport, styles.text]}>{props.children}</div>
    </div>
  )
}
