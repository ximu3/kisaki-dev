import { onSettled, omit, type Accessor } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../dom'
import { createPopup, type PopupPlacement } from '../popup/controller'
import type { createTooltip } from './controller'
import frame from '../popup/surface.module.css'
import styles from './styles.module.css'

interface TooltipSurfaceProps extends JSX.HTMLAttributes<HTMLDivElement> {
  anchor: Accessor<HTMLElement | undefined>
  reading: ReturnType<typeof createTooltip>
  placement?: PopupPlacement
}

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
    element: () => content,
    anchor: props.anchor,
    open: props.reading.open,

    change: (open) => {
      if (!open) {
        props.reading.dismiss()
      }
    },

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
