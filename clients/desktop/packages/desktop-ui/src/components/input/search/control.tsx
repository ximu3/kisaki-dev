/** @fileoverview Native query editing with an integrated search icon and clear action. */

import { Show, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { fieldAttributes } from '../../../internal/field'
import { Icon, Search, X } from '../../../internal/icon/glyph'
import { createValue } from '../../../internal/state'
import { InputFrame } from '../frame'
import { NativeInput } from '../native'
import type { InputProps } from '../control'
import frame from '../styles.module.css'
import styles from './styles.module.css'

/** Native search attributes with a localized accessible name for the clear button. */
export interface SearchInputProps extends Omit<InputProps, 'type'> {
  clearLabel: string
}

/** Edits a query using its native input and returns focus there before clearing. */
export function SearchInput(props: SearchInputProps): JSX.Element {
  const rest = omit(
    props,
    'value',
    'defaultValue',
    'onValueChange',
    'clearLabel',
    'size',
    'ref',
    'class',
    'style',
  )
  const [value, change] = createValue(
    () => props.value,
    () => props.defaultValue ?? '',
    (text) => props.onValueChange?.(text),
  )
  const field = fieldAttributes(props)
  let editor!: HTMLInputElement

  function clear() {
    editor.focus()
    editor.value = ''
    editor.dispatchEvent(new Event('input', { bubbles: true }))
  }

  return (
    <InputFrame class={props.class} style={props.style} size={props.size}>
      <span class={styles.icon} aria-hidden="true">
        <Icon icon={Search} />
      </span>
      <NativeInput
        {...rest}
        type="search"
        ref={[
          (node) => {
            editor = node
          },
          props.ref,
        ]}
        value={value()}
        defaultValue={props.defaultValue}
        onValueChange={change}
        class={[frame.editor, styles.editor]}
      />
      <Show when={value() && !props.readonly}>
        <button
          class={styles.clear}
          type="button"
          aria-label={props.clearLabel}
          disabled={props.disabled ?? field.disabled}
          onClick={clear}
        >
          <Icon icon={X} />
        </button>
      </Show>
    </InputFrame>
  )
}
