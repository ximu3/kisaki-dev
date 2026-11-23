/** @fileoverview Hoverable, keyboard-readable tooltips with a shared reading lifetime. */

import { createContext, createUniqueId, omit, useContext } from 'solid-js'
import { dynamic } from '@solidjs/web'
import type { Accessor, ParentProps } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler, createAnchor } from '../../internal/dom'
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
  bindAnchor: () => (node: HTMLElement) => void
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
  const [anchor, bindAnchor] = createAnchor<HTMLElement>()

  return (
    <TooltipContext value={{ ...state, id: createUniqueId(), anchor, bindAnchor }}>
      {props.children}
    </TooltipContext>
  )
}

/**
 * Renders a native button with its own accessible name and the tooltip's supplemental description.
 */
export function TooltipTrigger(
  props: ButtonProps & { as?: (props: ButtonProps) => JSX.Element },
): JSX.Element {
  const state = useContext(TooltipContext)
  const rest = omit(
    props,
    'as',
    'ref',
    'onClick',
    'onPointerEnter',
    'onPointerLeave',
    'onFocus',
    'onBlur',
    'aria-describedby',
  )

  const Control = dynamic(() => props.as ?? Button)
  const anchorRef = state.bindAnchor()
  return (
    <Control
      {...rest}
      ref={[anchorRef, props.ref]}
      aria-describedby={[props['aria-describedby'], state.id].filter(Boolean).join(' ')}
      onClick={(event) => {
        state.dismiss()
        callHandler(props.onClick, event)
      }}
      onPointerEnter={(event) => {
        state.hover('trigger', true)
        callHandler(props.onPointerEnter, event)
      }}
      onPointerLeave={(event) => {
        state.hover('trigger', false)
        callHandler(props.onPointerLeave, event)
      }}
      onFocus={(event) => {
        state.focus(event)
        callHandler(props.onFocus, event)
      }}
      onBlur={(event) => {
        state.focus(event)
        callHandler(props.onBlur, event)
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
  const state = useContext(TooltipContext)
  return <TooltipSurface {...props} id={state.id} anchor={state.anchor} reading={state} />
}
