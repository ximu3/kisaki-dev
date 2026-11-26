import type { ValueChange } from '../../internal/state'
import { createContext, useContext, type Accessor } from 'solid-js'
import type { createSubmenuHover } from './hover'

export interface MenuState {
  id: string
  parent: MenuState | undefined

  open: Accessor<boolean>
  controlled: Accessor<boolean>
  change: ValueChange<boolean>

  anchor: Accessor<HTMLElement | undefined>
  bindAnchor: () => (node: HTMLElement) => void
  content: HTMLElement | undefined
  children: Set<MenuState>
  focusOnOpen: boolean
  hover: ReturnType<typeof createSubmenuHover>
  point: Accessor<{ x: number; y: number } | undefined>
  setPoint: (point: { x: number; y: number } | undefined) => void
  last: boolean
}

export const MenuContext = createContext<MenuState | null>(null)

export function useMenu(): MenuState {
  const state = useContext(MenuContext)
  if (!state) {
    throw new Error('Menu parts require Menu.')
  }

  return state
}
