/** @fileoverview A read-only tooltip surface shares native positioning and reading state. */

import { splitProps } from 'solid-js'
import type { Accessor, JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../dom'
import { createPopup } from '../popup/controller'
import type { PopupPlacement } from '../popup/controller'
import type { createTooltip } from './controller'
import frame from '../popup/surface.module.css'
import styles from './styles.module.css'

interface TooltipSurfaceProps extends JSX.HTMLAttributes<HTMLDivElement> {
  anchor: Accessor<HTMLElement>
  reading: ReturnType<typeof createTooltip>
  placement?: PopupPlacement
}

/** Keep the same explanation open while focus or pointer stays in its reading interaction. */
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

  createPopup({
    element: () => content,
    anchor: local.anchor,
    open: local.reading.open,
    change: (open) => {
      if (!open) {
        local.reading.dismiss()
      }
    },
    placement: () => local.placement ?? 'bottom-start',
    restoreFocus: false,
  })

  return (
    <div
      {...rest}
      role="tooltip"
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
