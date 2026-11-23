/** @fileoverview Drag handles, insertion geometry and accessible host-authored feedback. */

import { omit } from 'solid-js'
import { dynamic } from '@solidjs/web'
import type { Component } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Button } from '../button/control'
import type { ButtonProps } from '../button/control'
import { callHandler } from '../../internal/dom'
import { Icon, GripVertical } from '../../internal/icon/glyph'
import styles from './styles.module.css'

/** Action-button props with optional keyboard movement commands independent of pointer dragging. */
export interface DragHandleProps extends ButtonProps {
  /** Uses a compatible trigger, such as MenuTrigger, for the handle button. */
  as?: Component<ButtonProps>
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
  const rest = omit(props, 'as', 'onMove', 'onKeyDown', 'class', 'children')

  const Control = dynamic(() => props.as ?? Button)
  return (
    <Control
      variant="text"
      size="icon-sm"
      {...rest}
      class={[styles.handle, props.class]}
      aria-keyshortcuts={props.onMove ? 'Alt+ArrowUp Alt+ArrowDown' : undefined}
      onKeyDown={(event) => {
        callHandler(props.onKeyDown, event)
        if (
          !event.defaultPrevented &&
          event.altKey &&
          props.onMove &&
          (event.key === 'ArrowUp' || event.key === 'ArrowDown')
        ) {
          event.preventDefault()
          props.onMove(event.key === 'ArrowUp' ? 'previous' : 'next')
        }
      }}
    >
      {props.children ?? <Icon icon={GripVertical} />}
    </Control>
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
  const rest = omit(props, 'edge', 'gap', 'class', 'style')

  return (
    <div
      {...rest}
      aria-hidden="true"
      data-edge={props.edge}
      class={[styles.indicator, props.class]}
      style={
        typeof props.style === 'string'
          ? `--drop-gap: ${typeof props.gap === 'number' ? `${props.gap}px` : props.gap}; ${props.style}`
          : {
              '--drop-gap': typeof props.gap === 'number' ? `${props.gap}px` : props.gap,
              ...props.style,
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
  const rest = omit(props, 'class')

  return (
    <div
      {...rest}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class={[styles.feedback, props.class]}
    />
  )
}
