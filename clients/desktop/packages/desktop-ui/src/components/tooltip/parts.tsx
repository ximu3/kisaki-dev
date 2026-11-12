/** @fileoverview Hoverable, keyboard-readable tooltips with a shared reading lifetime. */

import { createContext, createUniqueId, splitProps, useContext } from 'solid-js'
import type { JSX, ParentProps } from 'solid-js'
import { assignRef, callHandler } from '../../internal/dom'
import { TooltipSurface } from '../../internal/tooltip/content'
import { createTooltip } from '../../internal/tooltip/controller'
import { Button } from '../button/control'
import type { ButtonProps } from '../button/control'

/**
 * Local reading-lifetime state with an accessible description identity and native trigger anchor.
 */
interface TooltipState extends ReturnType<typeof createTooltip> {
  id: string
  anchor: HTMLElement | undefined
}

const TooltipContext = createContext<TooltipState>()

/**
 * Read-only explanation composition with an optional pointer-opening delay.
 *
 * Tooltip content supplements an existing accessible name and contains no interactive controls.
 */
export interface TooltipProps extends ParentProps {
  /** Initial pointer wait in milliseconds. Defaults to 300. */
  delayMs?: number
}

/**
 * Provides one description identity and shared hover, focus and dismissal state for trigger and
 * content.
 */
export function Tooltip(props: TooltipProps): JSX.Element {
  const state = createTooltip(() => props.delayMs)

  return (
    <TooltipContext.Provider value={{ ...state, id: createUniqueId(), anchor: undefined }}>
      {props.children}
    </TooltipContext.Provider>
  )
}

/**
 * Renders a native button with its own accessible name and the tooltip's supplemental description.
 */
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

/**
 * Renders hoverable explanation content constrained to the viewport without taking keyboard focus.
 */
export function TooltipContent(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const state = useTooltip()
  return <TooltipSurface {...props} id={state.id} anchor={() => state.anchor!} reading={state} />
}

/** Returns the nearest tooltip state and rejects parts rendered outside a Tooltip owner. */
function useTooltip(): TooltipState {
  const state = useContext(TooltipContext)
  if (!state) {
    throw new Error('Tooltip parts require Tooltip.')
  }

  return state
}
