/** @fileoverview Hoverable, keyboard-readable tooltips with a shared reading lifetime. */

import { createContext, createUniqueId, splitProps, useContext } from 'solid-js'
import type { JSX, ParentProps } from 'solid-js'
import { assignRef, callHandler } from '../../internal/dom'
import { TooltipSurface } from '../../internal/tooltip/content'
import { createTooltip } from '../../internal/tooltip/controller'
import { Button } from '../button/control'
import type { ButtonProps } from '../button/control'

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
  return <TooltipSurface {...props} id={state.id} anchor={() => state.anchor!} reading={state} />
}

function useTooltip(): TooltipState {
  const state = useContext(TooltipContext)
  if (!state) {
    throw new Error('Tooltip parts require Tooltip.')
  }

  return state
}
