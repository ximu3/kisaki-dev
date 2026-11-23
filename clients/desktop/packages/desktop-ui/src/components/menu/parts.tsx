/** @fileoverview Dropdown and context menus share item navigation and nested native popovers. */

import {
  createContext,
  createEffect,
  createSignal,
  createUniqueId,
  Show,
  onCleanup,
  omit,
  useContext,
} from 'solid-js'
import type { Accessor, ParentProps } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler, createAnchor } from '../../internal/dom'
import { createValue } from '../../internal/state'
import { createFocusNavigation, focusableItems } from '../../internal/focus'
import { createPopup } from '../../internal/popup/controller'
import type { PopupPlacement } from '../../internal/popup/controller'
import { displayedWhileOpen } from '../../internal/popup/presentation'
import { Icon, Check, ChevronRight } from '../../internal/icon/glyph'
import { createSubmenuHover } from './hover'
import { Button } from '../button/control'
import { Separator } from '../separator/control'
import type { ButtonProps } from '../button/control'
import frame from '../../internal/popup/surface.module.css'
import row from '../../internal/list-row.module.css'
import styles from './styles.module.css'

/** Local menu-tree state, native anchors, focus intent and submenu hover coordination. */
interface MenuState {
  id: string
  parent: MenuState | undefined

  /** Reads the menu's current controlled or local open state. */
  open: Accessor<boolean>
  controlled: Accessor<boolean>
  /** Requests an open-state change while coordinating sibling and descendant menus. */
  change: (open: boolean) => void

  anchor: Accessor<HTMLElement | undefined>
  /** Registers the trigger for its mounted lifetime. */
  bindAnchor: () => (node: HTMLElement) => void
  content: HTMLElement | undefined
  children: Set<MenuState>
  focusOnOpen: boolean
  hover: ReturnType<typeof createSubmenuHover>
  /** Reads the context-menu anchor in viewport CSS pixels, or undefined for element anchoring. */
  point: Accessor<{ x: number; y: number } | undefined>
  /** Selects a pointer anchor or restores element-based positioning. */
  setPoint: (point: { x: number; y: number } | undefined) => void
  last: boolean
}

/** Menu state shared by triggers, items and nested compound parts. */
const MenuContext = createContext<MenuState | null>(null)

/**
 * Controlled or locally initialized state for a menu composition.
 *
 * Controlled callers adopt native dismissal requests. Nesting a Menu inside content creates a
 * submenu.
 */
export interface MenuProps extends ParentProps {
  open?: boolean
  defaultOpen?: boolean
  /** Reports the requested menu open state to its caller. */
  onOpenChange?: (open: boolean) => void
}

/** Owns dropdown, context-menu or submenu state and coordinates its menu-tree relationships. */
export function Menu(props: MenuProps): JSX.Element {
  const parent = useContext(MenuContext)
  /** Live menu visibility and change requests delegated to its value owner. */
  const [open, change] = createValue(
    () => props.open,
    () => props.defaultOpen ?? false,
    (next) => props.onOpenChange?.(next),
  )
  /** Optional pointer anchor used when the menu opens at a context position. */
  const [point, setPoint] = createSignal<{ x: number; y: number }>()
  const [anchor, bindAnchor] = createAnchor<HTMLElement>()
  const hover = createSubmenuHover({
    anchor,

    /** Reads the current submenu surface for pointer handoff. */
    content: () => state.content,
    isOpen: open,

    /** Opens through the menu owner without moving focus during pointer handoff. */
    open: () => {
      state.focusOnOpen = false
      state.change(true)
    },

    /** Requests submenu closure through the current value owner. */
    close: () => state.change(false),
  })
  const state: MenuState = {
    id: createUniqueId(),
    open,
    controlled: () => props.open !== undefined,
    change,
    anchor,
    bindAnchor,
    content: undefined,
    children: new Set(),
    focusOnOpen: true,
    hover,
    point,
    setPoint,
    last: false,
    parent: parent ?? undefined,
  }
  parent?.children.add(state)
  onCleanup(() => parent?.children.delete(state))
  createEffect(open, (shown) => {
    if (shown) {
      parent?.children.forEach((sibling) => {
        if (sibling !== state) {
          sibling.change(false)
        }
      })
    } else {
      hover.stop()
      state.children.forEach((child) => child.change(false))
    }
  })

  return <MenuContext value={state}>{props.children}</MenuContext>
}

/**
 * Renders a button trigger with pointer activation and first-or-last-item entry from vertical arrow
 * keys.
 */
export function MenuTrigger(props: ButtonProps): JSX.Element {
  const state = useMenu()
  const rest = omit(props, 'ref', 'onClick', 'onKeyDown')

  const anchorRef = state.bindAnchor()
  return (
    <Button
      {...rest}
      ref={[anchorRef, props.ref]}
      popovertarget={state.id}
      aria-haspopup="menu"
      aria-expanded={state.open() ? 'true' : 'false'}
      aria-controls={state.id}
      onClick={(event) => {
        callHandler(props.onClick, event)
        if (!event.defaultPrevented) {
          event.preventDefault()
          state.setPoint(undefined)
          state.last = false
          state.change(!state.open())
        }
      }}
      onKeyDown={(event) => {
        callHandler(props.onKeyDown, event)
        if (!event.defaultPrevented && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault()
          state.last = event.key === 'ArrowUp'
          state.change(true)
        }
      }}
    />
  )
}

/**
 * Renders a context-menu region supporting pointer requests and the keyboard context-menu command.
 */
export function ContextMenuTrigger(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const state = useMenu()
  const rest = omit(props, 'ref', 'onContextMenu', 'onKeyDown')

  const anchorRef = state.bindAnchor()
  return (
    <div
      tabindex={0}
      {...rest}
      ref={[anchorRef, props.ref]}
      aria-haspopup="menu"
      aria-expanded={state.open() ? 'true' : 'false'}
      aria-controls={state.id}
      onContextMenu={(event) => {
        callHandler(props.onContextMenu, event)
        if (!event.defaultPrevented) {
          event.preventDefault()
          state.setPoint({ x: event.clientX, y: event.clientY })
          state.last = false
          state.change(true)
        }
      }}
      onKeyDown={(event) => {
        callHandler(props.onKeyDown, event)
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

/**
 * Renders a native menu popup with real item focus and directional submenu navigation.
 *
 * Submenu content stays inside the parent content so native popover ancestry retains its parent.
 */
export function MenuContent(
  props: JSX.HTMLAttributes<HTMLDivElement> & { placement?: PopupPlacement },
): JSX.Element {
  const state = useMenu()
  const rest = omit(
    props,
    'class',
    'children',
    'ref',
    'placement',
    'onKeyDown',
    'onPointerEnter',
    'onPointerLeave',
  )

  let content!: HTMLDivElement
  let viewport!: HTMLDivElement
  const selector = '[role^="menuitem"]'
  /** Returns focusable items owned by this menu, excluding nested menu contents. */
  const items = () =>
    focusableItems(content, selector).filter((node) => node.closest('[role="menu"]') === content)

  createPopup({
    /** Reads the currently mounted menu surface. */
    element: () => content,

    anchor: state.anchor,
    open: state.open,
    controlled: state.controlled,
    change: state.change,
    point: state.point,

    /** Chooses a direction-aware submenu side or the root menu's preferred placement. */
    placement: (anchor) => {
      if (state.parent) {
        return getComputedStyle(anchor).direction === 'rtl' ? 'left-start' : 'right-start'
      }
      return props.placement ?? 'bottom-start'
    },
  })

  /** Vertical keyboard navigation across the menu's direct and grouped items. */
  const navigate = createFocusNavigation(
    () => viewport,
    ':scope > [role^="menuitem"], :scope > [role="group"] > [role^="menuitem"]',
    () => 'vertical',
  )
  createEffect(
    () => state.open(),
    (opened) => {
      if (opened && state.focusOnOpen) {
        queueMicrotask(() => {
          if (state.open()) {
            const options = items()
            ;(state.last ? options.at(-1) : options[0])?.focus()
          }
        })
      }
    },
  )

  return (
    <div
      {...rest}
      ref={[
        (node) => {
          content = node
          state.content = node
        },
        props.ref,
      ]}
      id={state.id}
      popover={state.controlled() ? 'manual' : 'auto'}
      role="menu"
      tabindex={-1}
      class={[frame.anchor, styles.root, props.class]}
      onPointerEnter={(event) => {
        state.hover.stop()
        callHandler(props.onPointerEnter, event)
      }}
      onPointerLeave={(event) => {
        if (state.parent && !content.contains(event.relatedTarget as Node | null)) {
          state.hover.leaveContent()
        }
        callHandler(props.onPointerLeave, event)
      }}
      onKeyDown={(event) => {
        callHandler(props.onKeyDown, event)
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
          queueMicrotask(() => {
            if (!state.open()) {
              state.anchor()?.focus()
            }
          })
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
        class={[frame.viewport, styles.items]}
      >
        {props.children}
      </div>
    </div>
  )
}

/**
 * Menu-action attributes with optional selection notification and closure policy.
 *
 * Selection closes the tree by default; preventing the click or setting closeOnSelect=false keeps
 * it open.
 */
export interface MenuItemProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Notifies the caller synchronously after accepted activation and before default menu closure.
   */
  onSelect?: () => void
  closeOnSelect?: boolean
  /** Supplies a decorative leading glyph in the menu's shared icon slot. */
  icon?: JSX.Element
  destructive?: boolean
}

/**
 * Renders a focusable menu action and coordinates selection and default tree closure.
 *
 * The caller owns asynchronous completion and feedback.
 */
export function MenuItem(props: MenuItemProps): JSX.Element {
  const state = useMenu()
  /** Displayed check state retained while the menu completes its exit transition. */
  const checked = displayedWhileOpen(state.open, () => props['aria-checked'])
  const rest = omit(
    props,
    'onSelect',
    'closeOnSelect',
    'destructive',
    'icon',
    'class',
    'onClick',
    'children',
    'onPointerMove',
  )

  return (
    <button
      type="button"
      {...rest}
      role={props.role ?? 'menuitem'}
      data-option-highlight="hover focus"
      tabindex={-1}
      data-destructive={props.destructive || undefined}
      class={[row.row, styles.item, props.class]}
      onPointerMove={(event) => {
        callHandler(props.onPointerMove, event)
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
        callHandler(props.onClick, event)
        if (event.defaultPrevented) {
          return
        }

        let trigger: HTMLElement | undefined
        props.onSelect?.()
        if (props.closeOnSelect !== false) {
          let current: MenuState | undefined = state
          while (current) {
            current.change(false)
            trigger = current.anchor()
            current = current.parent
          }
        }
        queueMicrotask(() => {
          if (!state.open()) {
            trigger?.focus()
          }
        })
      }}
    >
      <MenuItemLabel icon={props.icon}>{props.children}</MenuItemLabel>
      <Show when={checked() !== undefined}>
        <span aria-hidden="true" class={row.mark}>
          <Show when={checked() === 'true'}>
            <Icon icon={Check} />
          </Show>
        </span>
      </Show>
    </button>
  )
}

/** Checkable menu-action props with a caller-owned boolean value. */
export interface MenuCheckboxItemProps extends MenuItemProps {
  checked: boolean
  /** Reports the proposed checked value when the item is selected. */
  onCheckedChange: (checked: boolean) => void
}

/**
 * Renders menu-checkbox semantics and reports toggled state without adding form submission
 * behavior.
 */
export function MenuCheckboxItem(props: MenuCheckboxItemProps): JSX.Element {
  const rest = omit(props, 'checked', 'onCheckedChange', 'onSelect')

  return (
    <MenuItem
      {...rest}
      role="menuitemcheckbox"
      aria-checked={props.checked ? 'true' : 'false'}
      onSelect={() => {
        props.onCheckedChange(!props.checked)
        props.onSelect?.()
      }}
    />
  )
}

/** Radio menu-action props using the caller's shared selected value. */
export interface MenuRadioItemProps extends MenuItemProps {
  value: string
  selectedValue: string
  /** Reports this item's value when it is selected. */
  onValueChange: (value: string) => void
}

/**
 * Renders a radio menu action against the caller's selected value.
 *
 * Related items belong in a named MenuGroup.
 */
export function MenuRadioItem(props: MenuRadioItemProps): JSX.Element {
  const rest = omit(props, 'value', 'selectedValue', 'onValueChange', 'onSelect')

  return (
    <MenuItem
      {...rest}
      role="menuitemradio"
      aria-checked={props.value === props.selectedValue ? 'true' : 'false'}
      onSelect={() => {
        props.onValueChange(props.value)
        props.onSelect?.()
      }}
    />
  )
}

/**
 * Renders a nested-menu trigger with hover intent and directional keyboard entry.
 *
 * Entry and return arrows follow the document's writing direction.
 */
export function MenuSubTrigger(props: ButtonProps & Pick<MenuItemProps, 'icon'>): JSX.Element {
  const state = useMenu()
  const rest = omit(
    props,
    'class',
    'ref',
    'onClick',
    'onKeyDown',
    'children',
    'icon',
    'onPointerEnter',
    'onPointerLeave',
  )

  const anchorRef = state.bindAnchor()
  return (
    <button
      type="button"
      {...rest}
      role="menuitem"
      data-option-highlight="hover focus"
      tabindex={-1}
      ref={[anchorRef, props.ref]}
      class={[row.row, styles.item, props.class]}
      popovertarget={state.id}
      aria-haspopup="menu"
      aria-expanded={state.open() ? 'true' : 'false'}
      aria-controls={state.id}
      onPointerEnter={(event) => {
        callHandler(props.onPointerEnter, event)
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
        callHandler(props.onPointerLeave, event)
      }}
      onClick={(event) => {
        callHandler(props.onClick, event)
        if (!event.defaultPrevented) {
          event.preventDefault()
          state.focusOnOpen = true
          state.change(!state.open())
        }
      }}
      onKeyDown={(event) => {
        callHandler(props.onKeyDown, event)
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
      <MenuItemLabel icon={props.icon}>{props.children}</MenuItemLabel>
      <span aria-hidden="true" class={styles.arrow}>
        <Icon icon={ChevronRight} />
      </span>
    </button>
  )
}

/** Keeps the decorative glyph, accessible caption and trailing marker in distinct slots. */
function MenuItemLabel(props: ParentProps<Pick<MenuItemProps, 'icon'>>): JSX.Element {
  return (
    <>
      <Show when={props.icon}>
        <span aria-hidden="true" class={styles.icon}>
          {props.icon}
        </span>
      </Show>
      <span class={styles.label}>{props.children}</span>
    </>
  )
}

/** Renders a caller-named item group within the existing menu-navigation scope. */
export function MenuGroup(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div {...props} role="group" />
}

/** Separates action groups semantically without adding a focus stop. */
export function MenuSeparator(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <Separator {...rest} decorative={false} class={[styles.separator, props.class]} />
}

/** Returns the nearest menu state and rejects parts rendered outside a Menu owner. */
function useMenu(): MenuState {
  const state = useContext(MenuContext)
  if (!state) {
    throw new Error('Menu parts require Menu.')
  }

  return state
}
