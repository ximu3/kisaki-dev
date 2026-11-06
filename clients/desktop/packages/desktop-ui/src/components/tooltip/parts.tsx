/** @fileoverview Hoverable, keyboard-readable tooltips with a local timer lifetime. */

import {
  createContext,
  createSignal,
  createUniqueId,
  onCleanup,
  splitProps,
  useContext,
} from 'solid-js'
import type { Accessor, JSX, ParentProps } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { createPopup } from '../../internal/popup'
import { Button } from '../button/control'
import type { ButtonProps } from '../button/control'
import styles from './styles.module.css'

interface TooltipState {
  id: string
  anchor: HTMLElement | undefined

  open: Accessor<boolean>
  setOpen: (open: boolean) => void

  enter: (immediate?: boolean) => void
  leave: () => void
}

const TooltipContext = createContext<TooltipState>()

/** Tooltip supplements an existing accessible name; content contains no interactive controls. */
export interface TooltipProps extends ParentProps {
  delayMs?: number
}

/** Own one tooltip and its delay. Hovering the content continues the same reading interaction. */
export function Tooltip(props: TooltipProps): JSX.Element {
  const [open, setOpen] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))

  const enter = (immediate = false) => {
    clearTimeout(timer)
    if (immediate) {
      setOpen(true)
    } else {
      timer = setTimeout(() => setOpen(true), props.delayMs ?? 400)
    }
  }
  const leave = () => {
    clearTimeout(timer)
    timer = setTimeout(() => setOpen(false), 120)
  }

  return (
    <TooltipContext.Provider
      value={{ id: createUniqueId(), open, setOpen, enter, leave, anchor: undefined }}
    >
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
        state.enter()
        callHandler(local.onPointerEnter, event)
      }}
      onPointerLeave={(event) => {
        state.leave()
        callHandler(local.onPointerLeave, event)
      }}
      onFocus={(event) => {
        state.enter(true)
        callHandler(local.onFocus, event)
      }}
      onBlur={(event) => {
        state.leave()
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
    change: state.setOpen,
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
        state.enter(true)
        callHandler(local.onPointerEnter, event)
      }}
      onPointerLeave={(event) => {
        state.leave()
        callHandler(local.onPointerLeave, event)
      }}
    />
  )
}

/** Resolve the tooltip's local timer and presentation owner. */
function useTooltip(): TooltipState {
  const state = useContext(TooltipContext)
  if (!state) {
    throw new Error('Tooltip parts require Tooltip.')
  }

  return state
}
