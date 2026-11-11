/** @fileoverview Drag handles, insertion geometry and accessible host-authored feedback. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { Button } from '../button/control'
import type { ButtonProps } from '../button/control'
import { callHandler, classes } from '../../internal/dom'
import { Icon, mdiDrag } from '../../internal/icon/glyph'
import styles from './styles.module.css'

/** Optional keyboard movement is a direct host command, independent of pointer drag state. */
export interface DragHandleProps extends ButtonProps {
  onMove?: (direction: 'previous' | 'next') => void
}

/** Name the handle and attach its ref to createDraggable. Click can open the host's movement menu. */
export function DragHandle(props: DragHandleProps): JSX.Element {
  const [local, rest] = splitProps(props, ['onMove', 'onKeyDown', 'class', 'children'])

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      {...rest}
      class={classes(styles.handle, local.class)}
      aria-keyshortcuts={local.onMove ? 'Alt+ArrowUp Alt+ArrowDown' : undefined}
      onKeyDown={(event) => {
        callHandler(local.onKeyDown, event)
        if (
          !event.defaultPrevented &&
          event.altKey &&
          local.onMove &&
          (event.key === 'ArrowUp' || event.key === 'ArrowDown')
        ) {
          event.preventDefault()
          local.onMove(event.key === 'ArrowUp' ? 'previous' : 'next')
        }
      }}
    >
      {local.children ?? <Icon path={mdiDrag} />}
    </Button>
  )
}

/** Edge is actual target geometry, not a persisted row index. */
export interface DropIndicatorProps extends JSX.HTMLAttributes<HTMLDivElement> {
  edge: 'top' | 'right' | 'bottom' | 'left'
  /** Actual gap between neighboring target boxes, as CSS pixels or a CSS length. */
  gap: number | string
}

/** Position inside a relatively positioned target when the host has confirmed it can accept the drop. */
export function DropIndicator(props: DropIndicatorProps): JSX.Element {
  const [local, rest] = splitProps(props, ['edge', 'gap', 'class', 'style'])

  return (
    <div
      {...rest}
      aria-hidden="true"
      data-edge={local.edge}
      class={classes(styles.indicator, local.class)}
      style={
        typeof local.style === 'string'
          ? `--drop-gap: ${typeof local.gap === 'number' ? `${local.gap}px` : local.gap}; ${local.style}`
          : {
              '--drop-gap': typeof local.gap === 'number' ? `${local.gap}px` : local.gap,
              ...local.style,
            }
      }
    />
  )
}

/** Host-owned description of movement, completion or cancellation; no object identity is inferred. */
export function DragFeedback(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <div
      {...rest}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class={classes(styles.feedback, local.class)}
    />
  )
}
