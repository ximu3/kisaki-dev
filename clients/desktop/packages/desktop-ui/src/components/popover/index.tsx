import { createContext, createUniqueId, omit, useContext } from 'solid-js'
import type { Accessor, ParentProps } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler, createAnchor } from '../../internal/dom'
import { createValue } from '../../internal/state'
import { createPopup, type PopupPlacement } from '../../internal/popup/controller'
import { Button, type ButtonProps } from '../button'
import frame from '../../internal/popup/surface.module.css'
import styles from './styles.module.css'

export type { PopupPlacement } from '../../internal/popup/controller'

/** Local popup identity, anchor and shared open-state ownership. */
interface PopoverState {
  id: string
  anchor: Accessor<HTMLElement | undefined>
  /** Registers the trigger for its mounted lifetime. */
  bindAnchor: () => (node: HTMLElement) => void

  open: Accessor<boolean>
  /** Reports whether the caller owns visibility and must adopt a dismissal request. */
  controlled: Accessor<boolean>
  change: (value: boolean) => void
}

/** Popover state shared by the trigger and content within their owning Solid tree. */
const PopoverContext = createContext<PopoverState>()

/**
 * Popover composition with controlled or locally initialized open state.
 *
 * A controlled popup changes visibility when its caller adopts the open-change request.
 */
export interface PopoverProps extends ParentProps {
  open?: boolean
  defaultOpen?: boolean
  /** Reports the requested popover open state to its caller. */
  onOpenChange?: (open: boolean) => void
}

/** Establishes local popup identity and state within its actual document and modal ancestry. */
export function Popover(props: PopoverProps): JSX.Element {
  const [open, change] = createValue(
    () => props.open,
    () => props.defaultOpen ?? false,
    (next) => props.onOpenChange?.(next),
  )
  const [anchor, bindAnchor] = createAnchor<HTMLElement>()
  const controlled = () => props.open !== undefined

  return (
    <PopoverContext value={{ id: createUniqueId(), open, controlled, change, anchor, bindAnchor }}>
      {props.children}
    </PopoverContext>
  )
}

/** Renders a button that toggles the associated popup and exposes its expanded state. */
export function PopoverTrigger(props: ButtonProps): JSX.Element {
  const state = useContext(PopoverContext)
  const rest = omit(props, 'ref', 'onClick')

  const anchorRef = state.bindAnchor()
  return (
    <Button
      {...rest}
      ref={[anchorRef, props.ref]}
      aria-expanded={state.open() ? 'true' : 'false'}
      aria-controls={state.id}
      popovertarget={state.id}
      onClick={(event) => {
        callHandler(props.onClick, event)
        if (!event.defaultPrevented) {
          event.preventDefault()
          state.change(!state.open())
        }
      }}
    />
  )
}

/**
 * Native popup content attributes, placement and optional viewport styling.
 *
 * Autofocus may designate the initial focus target.
 */
export interface PopoverContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  placement?: PopupPlacement
  /** Style the content viewport independently of the positioned native panel. */
  viewportClass?: string
}

/**
 * Positions interactive content in the native top layer and routes dismissal to its owner.
 *
 * Children retain the lifetime of the caller's mounted content.
 */
export function PopoverContent(props: PopoverContentProps): JSX.Element {
  const state = useContext(PopoverContext)
  const rest = omit(props, 'placement', 'class', 'viewportClass', 'children', 'ref')

  let node!: HTMLDivElement
  createPopup({
    element: () => node,

    anchor: state.anchor,
    open: state.open,
    change: state.change,
    controlled: state.controlled,

    placement: () => props.placement ?? 'bottom-start',
    nativePlacement: true,
  })

  return (
    <div
      {...rest}
      id={state.id}
      popover={state.controlled() ? 'manual' : 'auto'}
      ref={[
        (element) => {
          node = element
        },
        props.ref,
      ]}
      class={[frame.anchor, props.class]}
    >
      <div class={[frame.viewport, styles.content, props.viewportClass]}>{props.children}</div>
    </div>
  )
}

/** Requests closing the popover and returns focus to its anchor after accepted activation. */
export function PopoverClose(props: ButtonProps): JSX.Element {
  const state = useContext(PopoverContext)
  const rest = omit(props, 'onClick')

  return (
    <Button
      {...rest}
      onClick={(event) => {
        callHandler(props.onClick, event)
        if (!event.defaultPrevented) {
          state.change(false)
          queueMicrotask(() => {
            if (!state.open()) {
              state.anchor()?.focus()
            }
          })
        }
      }}
    />
  )
}
