/** @fileoverview Hoverable, keyboard-readable tooltips with a shared reading lifetime. */

import { createContext, createUniqueId, splitProps, useContext } from 'solid-js'
import type { JSX, ParentProps } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { createPopup } from '../../internal/popup'
import { createTooltip } from '../../internal/tooltip'
import { Button } from '../button/control'
import type { ButtonProps } from '../button/control'
import styles from './styles.module.css'

interface TooltipState extends ReturnType<typeof createTooltip> {
  id: string
  anchor: HTMLElement | undefined
}

const TooltipContext = createContext<TooltipState>()

/** Tooltip supplements an existing accessible name; content contains no interactive controls. */
export interface TooltipProps extends ParentProps {
  delayMs?: number
}

/** Trigger and content share hover and focus state, including Escape dismissal. */
export function Tooltip(props: TooltipProps): JSX.Element {
  const state = createTooltip(() => props.delayMs ?? 400)

  return (
    <TooltipContext.Provider value={{ ...state, id: createUniqueId(), anchor: undefined }}>
      {props.children}
    </TooltipContext.Provider>
  )
}

/** A native button with its own name and a supplemental description. */
export function TooltipTrigger(props: ButtonProps): JSX.Element {
  const state = useTooltip()
  const [local, rest] = splitProps(props, [
    'ref',
    'onPointerEnter',
    'onPointerLeave',
    'onFocus',
    'onBlur',
    'aria-describedby',
  ])

  return (
    <Button
      {...rest}
      ref={(node) => {
        state.anchor = node
        assignRef(local.ref, node)
      }}
      aria-describedby={[local['aria-describedby'], state.id].filter(Boolean).join(' ')}
      onPointerEnter={(event) => {
        state.hover('trigger', true)
        callHandler(local.onPointerEnter, event)
      }}
      onPointerLeave={(event) => {
        state.hover('trigger', false)
        callHandler(local.onPointerLeave, event)
      }}
      onFocus={(event) => {
        state.focus(true)
        callHandler(local.onFocus, event)
      }}
      onBlur={(event) => {
        state.focus(false)
        callHandler(local.onBlur, event)
      }}
    />
  )
}

/** Hoverable explanation constrained to the viewport, without taking keyboard focus. */
export function TooltipContent(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const state = useTooltip()
  const [local, rest] = splitProps(props, ['class', 'onPointerEnter', 'onPointerLeave', 'ref'])

  let content!: HTMLDivElement
  createPopup({
    element: () => content,
    anchor: () => state.anchor!,
    open: state.open,
    change: (open) => {
      if (!open) {
        state.dismiss()
      }
    },
    restoreFocus: false,
  })

  return (
    <div
      {...rest}
      ref={(node) => {
        content = node
        assignRef(local.ref, node)
      }}
      id={state.id}
      popover="manual"
      role="tooltip"
      class={classes(styles.root, local.class)}
      onPointerEnter={(event) => {
        state.hover('content', true)
        callHandler(local.onPointerEnter, event)
      }}
      onPointerLeave={(event) => {
        state.hover('content', false)
        callHandler(local.onPointerLeave, event)
      }}
    />
  )
}

function useTooltip(): TooltipState {
  const state = useContext(TooltipContext)
  if (!state) {
    throw new Error('Tooltip parts require Tooltip.')
  }

  return state
}
