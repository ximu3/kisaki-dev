/** @fileoverview Drag handles, insertion geometry and accessible host-authored feedback. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { Button } from '../button/control'
import type { ButtonProps } from '../button/control'
import { callHandler, classes } from '../../internal/dom'
import { Icon, GripVertical } from '../../internal/icon/glyph'
import styles from './styles.module.css'

/** Action-button props with optional keyboard movement commands independent of pointer dragging. */
export interface DragHandleProps extends ButtonProps {
  /**
   * Requests previous or next movement through the host when its keyboard shortcut is activated.
   */
  onMove?: (direction: 'previous' | 'next') => void
}

/**
 * Renders an accessible action handle with optional Alt+Arrow movement commands.
 *
 * The host supplies its accessible name, registers the ref for dragging and may use click to open a
 * movement menu.
 */
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
      {local.children ?? <Icon icon={GripVertical} />}
    </Button>
  )
}

/** Decorative insertion marker positioned from a target edge and actual neighboring-box gap. */
export interface DropIndicatorProps extends JSX.HTMLAttributes<HTMLDivElement> {
  edge: 'top' | 'right' | 'bottom' | 'left'
  /** Actual gap between neighboring target boxes, as CSS pixels or a CSS length. */
  gap: number | string
}

/**
 * Renders an insertion marker inside a relatively positioned target the host has accepted for
 * dropping.
 */
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

/**
 * Announces host-authored movement, completion or cancellation feedback through a polite status
 * region.
 */
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
