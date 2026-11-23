import {
  createEffect,
  createSignal,
  createUniqueId,
  onCleanup,
  useContext,
  type ParentProps,
} from 'solid-js'
import type { JSX } from '@solidjs/web'
import { createAnchor } from '../../internal/dom'
import { createValue } from '../../internal/state'
import { createSubmenuHover } from './hover'
import { MenuContext, type MenuState } from './state'

export { MenuTrigger, ContextMenuTrigger, MenuSubTrigger } from './trigger'
export { MenuContent } from './content'
export {
  MenuItem,
  MenuCheckboxItem,
  MenuRadioItem,
  MenuGroup,
  MenuSeparator,
  type MenuItemProps,
  type MenuCheckboxItemProps,
  type MenuRadioItemProps,
} from './items'

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
  const [open, change] = createValue(
    () => props.open,
    () => props.defaultOpen ?? false,
    (next) => props.onOpenChange?.(next),
  )
  const [point, setPoint] = createSignal<{ x: number; y: number }>()
  const [anchor, bindAnchor] = createAnchor<HTMLElement>()
  const hover = createSubmenuHover({
    anchor,

    content: () => state.content,
    isOpen: open,

    // Pointer handoff opens the submenu without stealing focus from the current item.
    open: () => {
      state.focusOnOpen = false
      state.change(true)
    },

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
