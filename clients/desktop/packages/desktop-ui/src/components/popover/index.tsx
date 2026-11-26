import {
  onSettled,
  createContext,
  createUniqueId,
  omit,
  useContext,
  type Accessor,
  type ParentProps,
} from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler, createAnchor } from '../../internal/dom'
import { createValue, type ValueChange } from '../../internal/state'
import { createPopup, type PopupPlacement } from '../../internal/popup/controller'
import { Button, type ButtonProps } from '../button'
import frame from '../../internal/popup/surface.module.css'
import styles from './styles.module.css'

export type { PopupPlacement } from '../../internal/popup/controller'

interface PopoverState {
  id: string
  anchor: Accessor<HTMLElement | undefined>
  bindAnchor: () => (node: HTMLElement) => void

  open: Accessor<boolean>
  controlled: Accessor<boolean>
  change: ValueChange<boolean>
}

const PopoverContext = createContext<PopoverState>()

export interface PopoverProps extends ParentProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

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
          state.change((open) => !open)
        }
      }}
    />
  )
}

export interface PopoverContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  placement?: PopupPlacement
  viewportClass?: string
}

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
          onSettled(() => {
            if (!state.open()) {
              state.anchor()?.focus()
            }
          })
        }
      }}
    />
  )
}
