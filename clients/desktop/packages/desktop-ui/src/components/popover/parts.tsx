/** @fileoverview Local popover composition on the browser top layer. */

import { createContext, createUniqueId, splitProps, useContext } from 'solid-js'
import type { Accessor, JSX, ParentProps } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { createValue } from '../../internal/state'
import { createPopup } from '../../internal/popup/controller'
import type { PopupPlacement } from '../../internal/popup/controller'
import { Button } from '../button/control'
import type { ButtonProps } from '../button/control'
import frame from '../../internal/popup/surface.module.css'
import styles from './styles.module.css'

/** Local popup identity, anchor and shared open-state ownership. */
interface PopoverState {
  id: string
  anchor: HTMLElement | undefined

  /** Reads the popover's current controlled or local open state. */
  open: Accessor<boolean>
  /** Requests a new open state through the popover's value owner. */
  change: (value: boolean) => void
}

/** Popover state shared by the trigger and content within their owning Solid tree. */
const PopoverContext = createContext<PopoverState>()

/**
 * Popover composition with controlled or locally initialized open state.
 *
 * Controlled callers adopt open-change requests, including native light dismissal.
 */
export interface PopoverProps extends ParentProps {
  open?: boolean
  defaultOpen?: boolean
  /** Reports the requested popover open state to its caller. */
  onOpenChange?: (open: boolean) => void
}

/** Establishes local popup identity and state within its actual document and modal ancestry. */
export function Popover(props: PopoverProps): JSX.Element {
  /** Live popover visibility and change requests delegated to its value owner. */
  const [open, change] = createValue(
    () => props.open,
    () => props.defaultOpen ?? false,
    (next) => props.onOpenChange?.(next),
  )

  return (
    <PopoverContext.Provider value={{ id: createUniqueId(), open, change, anchor: undefined }}>
      {props.children}
    </PopoverContext.Provider>
  )
}

/** Renders a button that toggles the associated popup and exposes its expanded state. */
export function PopoverTrigger(props: ButtonProps): JSX.Element {
  const state = usePopover()
  const [local, rest] = splitProps(props, ['ref', 'onClick'])

  return (
    <Button
      {...rest}
      ref={(node) => {
        state.anchor = node
        assignRef(local.ref, node)
      }}
      aria-expanded={state.open()}
      aria-controls={state.id}
      popovertarget={state.id}
      onClick={(event) => {
        callHandler(local.onClick, event)
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
 * Positions interactive content in a native popover with browser dismissal behavior.
 *
 * Children retain the lifetime of the caller's mounted content.
 */
export function PopoverContent(props: PopoverContentProps): JSX.Element {
  const state = usePopover()
  const [local, rest] = splitProps(props, [
    'placement',
    'class',
    'viewportClass',
    'children',
    'ref',
  ])

  let node!: HTMLDivElement
  createPopup({
    /** Reads the currently mounted popover surface. */
    element: () => node,

    /** Reads the current popover anchor for positioning. */
    anchor: () => state.anchor!,
    open: state.open,
    change: state.change,

    /** Reads the caller's preferred placement with the shared default. */
    placement: () => local.placement ?? 'bottom-start',
  })

  return (
    <div
      {...rest}
      id={state.id}
      popover="auto"
      ref={(element) => {
        node = element
        assignRef(local.ref, element)
      }}
      class={classes(frame.anchor, local.class)}
    >
      <div class={classes(frame.viewport, styles.content, local.viewportClass)}>
        {local.children}
      </div>
    </div>
  )
}

/** Requests closing the popover and returns focus to its anchor after accepted activation. */
export function PopoverClose(props: ButtonProps): JSX.Element {
  const state = usePopover()
  const [local, rest] = splitProps(props, ['onClick'])

  return (
    <Button
      {...rest}
      onClick={(event) => {
        callHandler(local.onClick, event)
        if (!event.defaultPrevented) {
          state.change(false)
          state.anchor?.focus()
        }
      }}
    />
  )
}

/** Returns the nearest popover state and rejects parts rendered outside a Popover owner. */
function usePopover(): PopoverState {
  const state = useContext(PopoverContext)
  if (!state) {
    throw new Error('Popover parts require Popover.')
  }

  return state
}
