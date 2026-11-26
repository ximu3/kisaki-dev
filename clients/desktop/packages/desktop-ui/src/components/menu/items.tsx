import { onSettled, Show, omit, type ParentProps } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../../internal/dom'
import { mdiCheck } from '@mdi/js'
import { Icon } from '../icon'
import { displayedWhileOpen } from '../../internal/popup/presentation'
import row from '../../internal/list-row.module.css'
import { Separator } from '../separator'
import { useMenu, type MenuState } from './state'
import styles from './styles.module.css'

export interface MenuItemProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  onSelect?: () => void
  closeOnSelect?: boolean
  icon?: JSX.Element
  destructive?: boolean
}

export function MenuItem(props: MenuItemProps): JSX.Element {
  const state = useMenu()
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
        onSettled(() => {
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
            <Icon path={mdiCheck} />
          </Show>
        </span>
      </Show>
    </button>
  )
}

export interface MenuCheckboxItemProps extends MenuItemProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

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

export interface MenuRadioItemProps extends MenuItemProps {
  value: string
  selectedValue: string
  onValueChange: (value: string) => void
}

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

export function MenuGroup(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div {...props} role="group" />
}

export function MenuSeparator(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <Separator {...rest} decorative={false} class={[styles.separator, props.class]} />
}
