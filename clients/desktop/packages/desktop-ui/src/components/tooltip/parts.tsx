/** @fileoverview Hoverable, keyboard-readable tooltips with a shared reading lifetime. */

import { createContext, createUniqueId, splitProps, useContext } from 'solid-js'
import type { Accessor, JSX, ParentProps } from 'solid-js'
import { assignRef, callHandler, createElementRef } from '../../internal/dom'
import type { PopupPlacement } from '../../internal/popup/controller'
import { TooltipSurface } from '../../internal/tooltip/content'
import { createTooltip } from '../../internal/tooltip/controller'
import { Button } from '../button/control'
import type { ButtonProps } from '../button/control'

/**
 * Local reading-lifetime state with an accessible description identity and native trigger anchor.
 */
interface TooltipState extends ReturnType<typeof createTooltip> {
  id: string
  anchor: Accessor<HTMLElement | undefined>
  /** Registers the trigger for its mounted lifetime. */
  bindAnchor: (node: HTMLElement) => void
}

/** Tooltip state shared by its trigger and content within the owning Solid tree. */
const TooltipContext = createContext<TooltipState>()

/**
 * Read-only explanation composition with an optional pointer-opening delay.
 *
 * Tooltip content supplements an existing accessible name and contains no interactive controls.
 */
export interface TooltipProps extends ParentProps {
  /** Initial pointer wait in milliseconds. Defaults to 400. */
  delayMs?: number
}

/**
 * Provides one description identity and shared hover, focus and dismissal state for trigger and
 * content.
 */
export function Tooltip(props: TooltipProps): JSX.Element {
  const state = createTooltip(() => props.delayMs)
  const [anchor, bindAnchor] = createElementRef<HTMLElement>()

  return (
    <TooltipContext.Provider value={{ ...state, id: createUniqueId(), anchor, bindAnchor }}>
      {props.children}
    </TooltipContext.Provider>
  )
}

/**
 * Renders a native button with its own accessible name and the tooltip's supplemental description.
 */
export function TooltipTrigger(
  props: ButtonProps & { as?: (props: ButtonProps) => JSX.Element },
): JSX.Element {
  const state = useTooltip()
  const [local, rest] = splitProps(props, [
    'as',
    'ref',
    'onClick',
    'onPointerEnter',
    'onPointerLeave',
    'onFocus',
    'onBlur',
    'aria-describedby',
  ])

  const Trigger = local.as ?? Button

  return (
    <Trigger
      {...rest}
      ref={(node) => {
        state.bindAnchor(node)
        assignRef(local.ref, node)
      }}
      aria-describedby={[local['aria-describedby'], state.id].filter(Boolean).join(' ')}
      onClick={(event) => {
        state.dismiss()
        callHandler(local.onClick, event)
      }}
      onPointerEnter={(event) => {
        state.hover('trigger', true)
        callHandler(local.onPointerEnter, event)
      }}
      onPointerLeave={(event) => {
        state.hover('trigger', false)
        callHandler(local.onPointerLeave, event)
      }}
      onFocus={(event) => {
        state.focus(event)
        callHandler(local.onFocus, event)
      }}
      onBlur={(event) => {
        state.focus(event)
        callHandler(local.onBlur, event)
      }}
    />
  )
}

/** Native tooltip attributes and the preferred side of the owning trigger. */
export interface TooltipContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  placement?: PopupPlacement
}

/**
 * Renders hoverable explanation content constrained to the viewport without taking keyboard focus.
 */
export function TooltipContent(props: TooltipContentProps): JSX.Element {
  const state = useTooltip()
  return <TooltipSurface {...props} id={state.id} anchor={state.anchor} reading={state} />
}

/** Returns the nearest tooltip state and rejects parts rendered outside a Tooltip owner. */
function useTooltip(): TooltipState {
  const state = useContext(TooltipContext)
  if (!state) {
    throw new Error('Tooltip parts require Tooltip.')
  }

  return state
}
