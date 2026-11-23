import { createContext, useContext, type Accessor } from 'solid-js'
import type { createSubmenuHover } from './hover'

/** Local menu-tree state, native anchors, focus intent and submenu hover coordination. */
export interface MenuState {
  id: string
  parent: MenuState | undefined

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
  setPoint: (point: { x: number; y: number } | undefined) => void
  last: boolean
}

/** Menu state shared by triggers, items and nested compound parts. */
export const MenuContext = createContext<MenuState | null>(null)

/** Returns the nearest menu state and rejects parts rendered outside a Menu owner. */
export function useMenu(): MenuState {
  const state = useContext(MenuContext)
  if (!state) {
    throw new Error('Menu parts require Menu.')
  }

  return state
}
