/** @fileoverview Stable option identities and optional virtual list rendering. */

import type { Accessor, JSX } from 'solid-js'

/** label supports search and selected text; content customizes the visible row. */
export interface SelectionOption {
  readonly value: string
  readonly label: string
  readonly description?: string
  readonly group?: string
  readonly content?: JSX.Element
  readonly disabled?: boolean
}

/** Render every visible virtual row through renderOption to retain its interaction and ARIA. */
export interface SelectionListRenderProps {
  options: Accessor<readonly SelectionOption[]>
  open: Accessor<boolean>
  /** Enable virtual geometry for the full time the viewport is painted, including its exit. */
  present: Accessor<boolean>
  renderOption: (option: SelectionOption) => JSX.Element
}

/** The host owns virtual geometry; scrollToValue makes the active key visible and mounted. */
export interface SelectionListProps {
  renderOptions?: ((props: SelectionListRenderProps) => JSX.Element) | undefined
  scrollToValue?: ((value: string) => void) | undefined
  /** The listbox viewport owns both scroll axes and the virtual row origin. */
  listRef?: ((element: HTMLDivElement) => void) | undefined
  listClass?: string | undefined
}
