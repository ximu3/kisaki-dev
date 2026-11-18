/** @fileoverview Stable option identities and optional virtual list rendering. */

import type { Accessor, JSX } from 'solid-js'

/**
 * Stable choice record with a value unique in its collection.
 *
 * Label supports search and selected text; content customizes the visible row.
 */
export interface SelectionOption<K extends string = string> {
  readonly value: K
  readonly label: string
  readonly description?: string
  readonly group?: string
  readonly content?: JSX.Element
  readonly disabled?: boolean
}

/**
 * Reactive collection and presentation state supplied to a custom row layout.
 *
 * Each visible row uses renderOption to retain shared interaction and accessibility semantics.
 */
export interface SelectionListRenderProps<O extends SelectionOption = SelectionOption> {
  /** Reads the complete current logical option collection, independently of mounted rows. */
  options: Accessor<readonly O[]>
  /** Reads whether the popup currently accepts interaction. */
  open: Accessor<boolean>
  /**
   * Reports whether the viewport remains painted, including exit presentation, for virtual geometry
   * lifetime.
   */
  present: Accessor<boolean>
  /** Renders one supplied option with its shared identity, interaction and accessible state. */
  renderOption: (option: O) => JSX.Element
}

/**
 * Optional custom row layout and viewport connections for host-owned virtualization.
 *
 * Virtual layouts use scrollToValue to make the active key visible and mounted.
 */
export interface SelectionListProps<O extends SelectionOption = SelectionOption> {
  /** Measures long grouped lists and scrolls keyboard highlights into the visible range. */
  virtual?: boolean | undefined
  /** Renders the supplied logical options using the shared row renderer and presentation state. */
  renderOptions?: ((props: SelectionListRenderProps<O>) => JSX.Element) | undefined
  /** Reveals and mounts the identified active option through the host's virtual layout. */
  scrollToValue?: ((value: O['value']) => void) | undefined
  /** Receives the mounted listbox viewport owning both scroll axes and the virtual-row origin. */
  listRef?: ((element: HTMLDivElement) => void) | undefined
  listClass?: string | undefined
}
