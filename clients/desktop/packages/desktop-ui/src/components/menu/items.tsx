import { Show, omit, type ParentProps } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../../internal/dom'
import { Icon, Check } from '../../internal/icon/glyph'
import { displayedWhileOpen } from '../../internal/popup/presentation'
import row from '../../internal/list-row.module.css'
import { Separator } from '../separator'
import { useMenu, type MenuState } from './state'
import styles from './styles.module.css'

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
  // Keep the last check state visible during the exit animation.
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

/** Keeps the decorative glyph, accessible caption and trailing marker in distinct slots. */
export function MenuItemLabel(props: ParentProps<Pick<MenuItemProps, 'icon'>>): JSX.Element {
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
