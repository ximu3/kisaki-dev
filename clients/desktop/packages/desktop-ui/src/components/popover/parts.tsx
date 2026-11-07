/** @fileoverview Local popover composition on the browser top layer. */

import { createContext, createUniqueId, splitProps, useContext } from 'solid-js'
import type { Accessor, JSX, ParentProps } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { createValue } from '../../internal/state'
import { createPopup } from '../../internal/popup/controller'
import type { PopupPlacement } from '../../internal/popup/controller'
import { Button } from '../button/control'
import type { ButtonProps } from '../button/control'
import surface from '../../internal/popup/surface.module.css'
import styles from './styles.module.css'

interface PopoverState {
  id: string
  anchor: HTMLElement | undefined

  open: Accessor<boolean>
  change: (value: boolean) => void
}

const PopoverContext = createContext<PopoverState>()

/** Adopt onOpenChange in controlled mode, including native light dismissal. */
export interface PopoverProps extends ParentProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Local interaction owner; keep content inside its actual document and modal ancestor. */
export function Popover(props: PopoverProps): JSX.Element {
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

/** A button trigger with reactive expanded state. */
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
      onClick={(event) => {
        callHandler(local.onClick, event)
        if (!event.defaultPrevented) {
          state.change(!state.open())
        }
      }}
    />
  )
}

/** Native popover content; autofocus may designate its first focus target. */
export interface PopoverContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  placement?: PopupPlacement
}

/** Light dismissal and Escape close only this popup; child resources follow the caller's mounted content. */
export function PopoverContent(props: PopoverContentProps): JSX.Element {
  const state = usePopover()
  const [local, rest] = splitProps(props, ['placement', 'class', 'ref'])

  let node!: HTMLDivElement
  createPopup({
    element: () => node,
    anchor: () => state.anchor!,
    open: state.open,
    change: state.change,
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
      class={classes(surface.surface, styles.root, local.class)}
    />
  )
}

/** End this popover's presentation without executing a business action. */
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

/** Resolve composition at the nearest actual owner. */
function usePopover(): PopoverState {
  const state = useContext(PopoverContext)
  if (!state) {
    throw new Error('Popover parts require Popover.')
  }

  return state
}
