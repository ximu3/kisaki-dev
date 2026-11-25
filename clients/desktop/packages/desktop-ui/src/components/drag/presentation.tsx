import { omit, type Component } from 'solid-js'
import { dynamic, type JSX } from '@solidjs/web'
import { Button, type ButtonProps } from '../button'
import { callHandler } from '../../internal/dom'
import { mdiDragVertical } from '@mdi/js'
import { Icon } from '../icon'
import styles from './styles.module.css'

export interface DragHandleProps extends ButtonProps {
  as?: Component<ButtonProps>
  onMove?: (direction: 'previous' | 'next') => void
}

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
      {props.children ?? <Icon path={mdiDragVertical} />}
    </Control>
  )
}

export interface DropIndicatorProps extends JSX.HTMLAttributes<HTMLDivElement> {
  edge: 'top' | 'right' | 'bottom' | 'left'
  gap: number | string
}

export function DropIndicator(props: DropIndicatorProps): JSX.Element {
  const rest = omit(props, 'edge', 'gap', 'class', 'style')
  const gap = () => (typeof props.gap === 'number' ? `${props.gap}px` : props.gap)

  return (
    <div
      {...rest}
      aria-hidden="true"
      data-edge={props.edge}
      class={[styles.indicator, props.class]}
      style={
        typeof props.style === 'string'
          ? `--drop-gap: ${gap()}; ${props.style}`
          : { '--drop-gap': gap(), ...props.style }
      }
    />
  )
}

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
