import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../../internal/dom'
import { Icon, ChevronRight } from '../../internal/icon/glyph'
import { Button, type ButtonProps } from '../button'
import row from '../../internal/list-row.module.css'
import { MenuItemLabel, type MenuItemProps } from './items'
import { useMenu } from './state'
import styles from './styles.module.css'

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
