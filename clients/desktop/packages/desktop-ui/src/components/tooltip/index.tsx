import {
  createContext,
  createUniqueId,
  omit,
  useContext,
  type Accessor,
  type ParentProps,
} from 'solid-js'
import { dynamic, type JSX } from '@solidjs/web'
import { callHandler, createAnchor } from '../../internal/dom'
import type { PopupPlacement } from '../../internal/popup/controller'
import { TooltipSurface } from '../../internal/tooltip/content'
import { createTooltip } from '../../internal/tooltip/controller'
import { Button, type ButtonProps } from '../button'

interface TooltipState extends ReturnType<typeof createTooltip> {
  id: string
  anchor: Accessor<HTMLElement | undefined>
  bindAnchor: () => (node: HTMLElement) => void
}

const TooltipContext = createContext<TooltipState>()

export interface TooltipProps extends ParentProps {
  delayMs?: number
}

export function Tooltip(props: TooltipProps): JSX.Element {
  const state = createTooltip(() => props.delayMs)
  const [anchor, bindAnchor] = createAnchor<HTMLElement>()

  return (
    <TooltipContext value={{ ...state, id: createUniqueId(), anchor, bindAnchor }}>
      {props.children}
    </TooltipContext>
  )
}

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

export interface TooltipContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  placement?: PopupPlacement
}

export function TooltipContent(props: TooltipContentProps): JSX.Element {
  const state = useContext(TooltipContext)
  return <TooltipSurface {...props} id={state.id} anchor={state.anchor} reading={state} />
}
