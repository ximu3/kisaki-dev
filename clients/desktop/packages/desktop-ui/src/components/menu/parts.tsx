/** @fileoverview Dropdown and context menus share item navigation and nested native popovers. */

import {
  createContext,
  createEffect,
  createSignal,
  createUniqueId,
  Show,
  onMount,
  splitProps,
  useContext,
} from 'solid-js'
import type { Accessor, JSX, ParentProps } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { createValue } from '../../internal/state'
import { createFocusNavigation, focusableItems } from '../../internal/focus'
import { createPopup } from '../../internal/popup'
import { Button } from '../button/control'
import type { ButtonProps } from '../button/control'
import styles from './styles.module.css'

interface MenuState {
  id: string
  parent: MenuState | undefined

  open: Accessor<boolean>
  change: (open: boolean) => void

  anchor: HTMLElement | undefined
  point: Accessor<{ x: number; y: number } | undefined>
  setPoint: (point: { x: number; y: number } | undefined) => void
  last: boolean
}

const MenuContext = createContext<MenuState>()

/** Controlled open state follows native dismissal; nesting a Menu inside content creates a submenu. */
export interface MenuProps extends ParentProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Own a dropdown, context menu or submenu. Menu actions remain synchronous UI notifications. */
export function Menu(props: MenuProps): JSX.Element {
  const parent = useContext(MenuContext)
  const [open, change] = createValue(
    () => props.open,
    () => props.defaultOpen ?? false,
    (next) => props.onOpenChange?.(next),
  )
  const [point, setPoint] = createSignal<{ x: number; y: number }>()

  return (
    <MenuContext.Provider
      value={{
        id: createUniqueId(),
        open,
        change,
        anchor: undefined,
        point,
        setPoint,
        last: false,
        parent,
      }}
    >
      {props.children}
    </MenuContext.Provider>
  )
}

/** Button trigger supports pointer activation and ArrowUp/ArrowDown entry. */
export function MenuTrigger(props: ButtonProps): JSX.Element {
  const state = useMenu()
  const [local, rest] = splitProps(props, ['ref', 'onClick', 'onKeyDown'])

  return (
    <Button
      {...rest}
      ref={(node) => {
        state.anchor = node
        assignRef(local.ref, node)
      }}
      aria-haspopup="menu"
      aria-expanded={state.open()}
      aria-controls={state.id}
      onClick={(event) => {
        callHandler(local.onClick, event)
        if (!event.defaultPrevented) {
          state.setPoint(undefined)
          state.last = false
          state.change(!state.open())
        }
      }}
      onKeyDown={(event) => {
        callHandler(local.onKeyDown, event)
        if (!event.defaultPrevented && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault()
          state.last = event.key === 'ArrowUp'
          state.change(true)
        }
      }}
    />
  )
}

/** Context-menu region preserves ordinary pointer and keyboard interaction until an explicit menu request. */
export function ContextMenuTrigger(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const state = useMenu()
  const [local, rest] = splitProps(props, ['ref', 'onContextMenu', 'onKeyDown'])

  return (
    <div
      tabIndex={0}
      {...rest}
      ref={(node) => {
        state.anchor = node
        assignRef(local.ref, node)
      }}
      aria-haspopup="menu"
      aria-expanded={state.open()}
      aria-controls={state.id}
      onContextMenu={(event) => {
        callHandler(local.onContextMenu, event)
        if (!event.defaultPrevented) {
          event.preventDefault()
          state.setPoint({ x: event.clientX, y: event.clientY })
          state.last = false
          state.change(true)
        }
      }}
      onKeyDown={(event) => {
        callHandler(local.onKeyDown, event)
        if (
          !event.defaultPrevented &&
          (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))
        ) {
          event.preventDefault()
          state.setPoint(undefined)
          state.last = false
          state.change(true)
        }
      }}
    />
  )
}

/** Place submenu content inside the parent MenuContent; the native popover ancestry retains its parent. */
export function MenuContent(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const state = useMenu()
  const [local, rest] = splitProps(props, ['class', 'ref', 'onKeyDown'])

  let content!: HTMLDivElement
  const selector = '[role^="menuitem"]'
  const items = () =>
    focusableItems(content, selector).filter((node) => node.closest('[role="menu"]') === content)

  createPopup({
    element: () => content,
    anchor: () => state.anchor!,
    open: state.open,
    change: state.change,
    point: state.point,
    placement: () => (state.parent ? 'right-start' : 'bottom-start'),
  })

  const navigate = createFocusNavigation(
    () => content,
    ':scope > [role^="menuitem"], :scope > [role="group"] > [role^="menuitem"]',
    () => 'vertical',
  )
  onMount(() =>
    createEffect(() => {
      if (state.open()) {
        queueMicrotask(() => {
          if (state.open()) {
            const options = items()
            ;(state.last ? options.at(-1) : options[0])?.focus()
          }
        })
      }
    }),
  )

  return (
    <div
      {...rest}
      ref={(node) => {
        content = node
        assignRef(local.ref, node)
      }}
      id={state.id}
      popover="auto"
      role="menu"
      tabIndex={-1}
      class={classes(styles.root, local.class)}
      onKeyDown={(event) => {
        callHandler(local.onKeyDown, event)
        if (event.defaultPrevented) {
          return
        }

        if (event.key === 'Tab') {
          state.change(false)
          return
        }

        const back = getComputedStyle(content).direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
        if (state.parent && event.key === back) {
          event.preventDefault()
          event.stopPropagation()
          state.change(false)
          state.anchor?.focus()
          return
        }

        navigate(event)
        event.stopPropagation()
      }}
    />
  )
}

/** Item selection closes the menu tree by default; prevent the click or set closeOnSelect=false to keep it open. */
export interface MenuItemProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  onSelect?: () => void
  closeOnSelect?: boolean
  destructive?: boolean
}

/** Real focus follows menu navigation. The caller owns asynchronous action completion and feedback. */
export function MenuItem(props: MenuItemProps): JSX.Element {
  const state = useMenu()
  const [local, rest] = splitProps(props, [
    'onSelect',
    'closeOnSelect',
    'destructive',
    'class',
    'onClick',
    'children',
  ])

  return (
    <button
      type="button"
      {...rest}
      role={props.role ?? 'menuitem'}
      tabIndex={-1}
      data-destructive={local.destructive || undefined}
      class={classes(styles.item, local.class)}
      onClick={(event) => {
        callHandler(local.onClick, event)
        if (event.defaultPrevented) {
          return
        }

        local.onSelect?.()
        if (local.closeOnSelect !== false) {
          let current: MenuState | undefined = state
          let trigger = state.anchor
          while (current) {
            current.change(false)
            trigger = current.anchor
            current = current.parent
          }
          trigger?.focus()
        }
      }}
    >
      <Show when={props['aria-checked'] !== undefined}>
        <span aria-hidden="true" class={styles.check}>
          {props['aria-checked'] === true ? '✓' : ''}
        </span>
      </Show>
      {local.children}
    </button>
  )
}

/** Checkbox menu values are caller-owned and may stay open for multiple choices. */
export interface MenuCheckboxItemProps extends MenuItemProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/** Expose checked state without using form semantics for a menu action. */
export function MenuCheckboxItem(props: MenuCheckboxItemProps): JSX.Element {
  const [local, rest] = splitProps(props, ['checked', 'onCheckedChange', 'onSelect'])

  return (
    <MenuItem
      {...rest}
      role="menuitemcheckbox"
      aria-checked={local.checked}
      onSelect={() => {
        local.onCheckedChange(!local.checked)
        local.onSelect?.()
      }}
    />
  )
}

/** Radio item selection uses the caller's shared group value. */
export interface MenuRadioItemProps extends MenuItemProps {
  value: string
  selectedValue: string
  onValueChange: (value: string) => void
}

/** Put related radio items in a named MenuGroup. */
export function MenuRadioItem(props: MenuRadioItemProps): JSX.Element {
  const [local, rest] = splitProps(props, ['value', 'selectedValue', 'onValueChange', 'onSelect'])

  return (
    <MenuItem
      {...rest}
      role="menuitemradio"
      aria-checked={local.value === local.selectedValue}
      onSelect={() => {
        local.onValueChange(local.value)
        local.onSelect?.()
      }}
    />
  )
}

/** The nested Menu owns this trigger and its sibling content. ArrowRight enters, ArrowLeft returns. */
export function MenuSubTrigger(props: ButtonProps): JSX.Element {
  const state = useMenu()
  const [local, rest] = splitProps(props, ['class', 'ref', 'onClick', 'onKeyDown', 'children'])

  return (
    <button
      type="button"
      {...rest}
      role="menuitem"
      tabIndex={-1}
      ref={(node) => {
        state.anchor = node
        assignRef(local.ref, node)
      }}
      class={classes(styles.item, local.class)}
      aria-haspopup="menu"
      aria-expanded={state.open()}
      aria-controls={state.id}
      onClick={(event) => {
        callHandler(local.onClick, event)
        if (!event.defaultPrevented) {
          state.change(!state.open())
        }
      }}
      onKeyDown={(event) => {
        callHandler(local.onKeyDown, event)
        const forward =
          getComputedStyle(event.currentTarget).direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
        if (!event.defaultPrevented && event.key === forward) {
          event.preventDefault()
          event.stopPropagation()
          state.change(true)
        }
      }}
    >
      {local.children}
      <span aria-hidden="true" class={styles.arrow}>
        ›
      </span>
    </button>
  )
}

/** Named menu grouping preserves one item-navigation scope. */
export function MenuGroup(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div {...props} role="group" />
}

/** Separate action groups without adding a focus stop. */
export function MenuSeparator(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <div {...rest} role="separator" class={classes(styles.separator, local.class)} />
}

/** Resolve the nearest menu state for item selection and submenu ancestry. */
function useMenu(): MenuState {
  const state = useContext(MenuContext)
  if (!state) {
    throw new Error('Menu parts require Menu.')
  }

  return state
}
