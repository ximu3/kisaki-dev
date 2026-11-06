/** @fileoverview Native single-line editing with field associations and reset synchronization. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { bindTextControl } from '../../internal/text-control'
import type { TextValueProps } from '../../internal/text-control'
import styles from './styles.module.css'

/** Value is text even for native numeric and calendar inputs; validation stays native. */
export interface InputProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'value' | 'type'>, TextValueProps {
  type?:
    | 'text'
    | 'password'
    | 'search'
    | 'email'
    | 'url'
    | 'tel'
    | 'number'
    | 'date'
    | 'time'
    | 'datetime-local'
    | 'month'
    | 'week'
}

/** Native input events, selection and undo remain available. Supply a label directly or with Field. */
export function Input(props: InputProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'value',
    'defaultValue',
    'onValueChange',
    'ref',
    'class',
    'onInput',
  ])

  let input!: HTMLInputElement
  const update = bindTextControl(local, () => input)

  return (
    <input
      type="text"
      {...fieldAttributes()}
      {...rest}
      ref={(node) => {
        input = node
        assignRef(local.ref, node)
      }}
      class={classes(styles.root, local.class)}
      onInput={(event) => {
        update()
        callHandler(local.onInput, event)
      }}
    />
  )
}
