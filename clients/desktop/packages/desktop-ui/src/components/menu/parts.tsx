/** @fileoverview Dropdown and context menus share item navigation and nested native popovers. */

import {
  batch,
  createContext,
  createEffect,
  createSignal,
  createUniqueId,
  Show,
  onCleanup,
  onMount,
  splitProps,
  useContext,
} from 'solid-js'
import type { Accessor, JSX, ParentProps } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { createValue } from '../../internal/state'
import { createFocusNavigation, focusableItems } from '../../internal/focus'
import { createPopup } from '../../internal/popup/controller'
import { displayedWhileOpen } from '../../internal/popup/presentation'
import { Icon, mdiCheck, mdiChevronRight } from '../../internal/icon/icon'
import { createSubmenuHover } from './hover'
import { Button } from '../button/control'
import { Separator } from '../separator/control'
import type { ButtonProps } from '../button/control'
import frame from '../../internal/popup/surface.module.css'
import row from '../../internal/list-row.module.css'
import styles from './styles.module.css'

interface MenuState {
  id: string
  parent: MenuState | undefined

  open: Accessor<boolean>
  change: (open: boolean) => void

  anchor: HTMLElement | undefined
  content: HTMLElement | undefined
  children: Set<MenuState>
  focusOnOpen: boolean
  hover: ReturnType<typeof createSubmenuHover>
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
  const hover = createSubmenuHover({
    anchor: () => state.anchor,
    content: () => state.content,
    isOpen: open,
    open: () => {
      state.focusOnOpen = false
      state.change(true)
    },
    close: () => state.change(false),
  })
  const state: MenuState = {
    id: createUniqueId(),
    open,
    change: (next) => {
      if (next) {
        parent?.children.forEach((sibling) => {
          if (sibling !== state) {
            sibling.change(false)
          }
        })
      } else {
        hover.stop()
        state.children.forEach((child) => child.change(false))
      }
      change(next)
    },
    anchor: undefined,
    content: undefined,
    children: new Set(),
    focusOnOpen: true,
    hover,
    point,
    setPoint,
    last: false,
    parent,
  }
  parent?.children.add(state)
  onCleanup(() => parent?.children.delete(state))
  createEffect(() => {
    if (!open()) {
      state.children.forEach((child) => child.change(false))
    }
  })

  return <MenuContext.Provider value={state}>{props.children}</MenuContext.Provider>
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
      popovertarget={state.id}
      aria-haspopup="menu"
      aria-expanded={state.open()}
      aria-controls={state.id}
      onClick={(event) => {
        callHandler(local.onClick, event)
        if (!event.defaultPrevented) {
          event.preventDefault()
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
  const [local, rest] = splitProps(props, [
    'class',
    'children',
    'ref',
    'onKeyDown',
    'onPointerEnter',
    'onPointerLeave',
  ])

  let content!: HTMLDivElement
  let viewport!: HTMLDivElement
  const selector = '[role^="menuitem"]'
  const items = () =>
    focusableItems(content, selector).filter((node) => node.closest('[role="menu"]') === content)

  createPopup({
    element: () => content,
    anchor: () => state.anchor!,
    open: state.open,
    change: state.change,
    point: state.point,
    placement: () => {
      if (state.parent) {
        return getComputedStyle(state.anchor!).direction === 'rtl' ? 'left-start' : 'right-start'
      }
      return 'bottom-start'
    },
  })

  const navigate = createFocusNavigation(
    () => viewport,
    ':scope > [role^="menuitem"], :scope > [role="group"] > [role^="menuitem"]',
    () => 'vertical',
  )
  onMount(() =>
    createEffect(() => {
      if (state.open() && state.focusOnOpen) {
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
        state.content = node
        assignRef(local.ref, node)
      }}
      id={state.id}
      popover="auto"
      role="menu"
      tabIndex={-1}
      class={classes(frame.anchor, styles.root, local.class)}
      onPointerEnter={(event) => {
        state.hover.stop()
        callHandler(local.onPointerEnter, event)
      }}
      onPointerLeave={(event) => {
        if (state.parent && !content.contains(event.relatedTarget as Node | null)) {
          state.hover.leaveContent()
        }
        callHandler(local.onPointerLeave, event)
      }}
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
    >
      <div
        ref={(node) => {
          viewport = node
        }}
        class={classes(frame.viewport, styles.items)}
      >
        {local.children}
      </div>
    </div>
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
  const checked = displayedWhileOpen(state.open, () => props['aria-checked'])
  const [local, rest] = splitProps(props, [
    'onSelect',
    'closeOnSelect',
    'destructive',
    'class',
    'onClick',
    'children',
    'onPointerMove',
  ])

  return (
    <button
      type="button"
      {...rest}
      role={props.role ?? 'menuitem'}
      data-option-highlight="hover focus"
      tabIndex={-1}
      data-destructive={local.destructive || undefined}
      class={classes(row.row, styles.item, local.class)}
      onPointerMove={(event) => {
        callHandler(local.onPointerMove, event)
        if (
          !event.defaultPrevented &&
          !event.currentTarget.disabled &&
          ![...state.children].some((child) => child.hover.inTransit())
        ) {
          state.children.forEach((child) => child.change(false))
          event.currentTarget.focus({ preventScroll: true })
        }
      }}
      onClick={(event) => {
        callHandler(local.onClick, event)
        if (event.defaultPrevented) {
          return
        }

        let trigger: HTMLElement | undefined
        batch(() => {
          local.onSelect?.()
          if (local.closeOnSelect !== false) {
            let current: MenuState | undefined = state
            while (current) {
              current.change(false)
              trigger = current.anchor
              current = current.parent
            }
          }
        })
        trigger?.focus()
      }}
    >
      <span class={styles.label}>{local.children}</span>
      <Show when={checked() !== undefined}>
        <span aria-hidden="true" class={row.mark}>
          <Show when={checked() === true}>
            <Icon path={mdiCheck} />
          </Show>
        </span>
      </Show>
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
  const [local, rest] = splitProps(props, [
    'class',
    'ref',
    'onClick',
    'onKeyDown',
    'children',
    'onPointerEnter',
    'onPointerLeave',
  ])

  return (
    <button
      type="button"
      {...rest}
      role="menuitem"
      data-option-highlight="hover focus"
      tabIndex={-1}
      ref={(node) => {
        state.anchor = node
        assignRef(local.ref, node)
      }}
      class={classes(row.row, styles.item, local.class)}
      popovertarget={state.id}
      aria-haspopup="menu"
      aria-expanded={state.open()}
      aria-controls={state.id}
      onPointerEnter={(event) => {
        callHandler(local.onPointerEnter, event)
        if (
          !event.defaultPrevented &&
          !event.currentTarget.disabled &&
          ![...(state.parent?.children ?? [])].some(
            (child) => child !== state && child.hover.inTransit(),
          )
        ) {
          event.currentTarget.focus({ preventScroll: true })
          state.hover.enter()
        }
      }}
      onPointerLeave={(event) => {
        state.hover.leave(event)
        callHandler(local.onPointerLeave, event)
      }}
      onClick={(event) => {
        callHandler(local.onClick, event)
        if (!event.defaultPrevented) {
          event.preventDefault()
          state.focusOnOpen = true
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
          state.focusOnOpen = true
          state.change(true)
        }
      }}
    >
      {local.children}
      <span aria-hidden="true" class={styles.arrow}>
        <Icon path={mdiChevronRight} />
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

  return <Separator {...rest} decorative={false} class={classes(styles.separator, local.class)} />
}

/** Resolve the nearest menu state for item selection and submenu ancestry. */
function useMenu(): MenuState {
  const state = useContext(MenuContext)
  if (!state) {
    throw new Error('Menu parts require Menu.')
  }

  return state
}
