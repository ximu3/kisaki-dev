import type { Accessor } from 'solid-js'
import type { JSX } from '@solidjs/web'

export interface SelectionOption<K extends string = string> {
  readonly value: K
  readonly label: string
  readonly description?: string
  readonly group?: string
  readonly content?: JSX.Element
  readonly disabled?: boolean
}

export interface SelectionListRenderProps<O extends SelectionOption = SelectionOption> {
  options: Accessor<readonly O[]>
  open: Accessor<boolean>
  present: Accessor<boolean>
  renderOption: (option: O) => JSX.Element
}

export interface SelectionListProps<O extends SelectionOption = SelectionOption> {
  virtual?: boolean | undefined
  renderOptions?: ((props: SelectionListRenderProps<O>) => JSX.Element) | undefined
  scrollToValue?: ((value: O['value']) => void) | undefined
  listRef?: ((element: HTMLDivElement) => void) | undefined
  listClass?: string | undefined
}
