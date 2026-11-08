/** @fileoverview Native single-line editing with field associations and reset synchronization. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { bindTextControl } from '../../internal/text-control'
import type { TextValueProps } from '../../internal/text-control'

/** Common native text binding; public controls choose the editing type and presentation. */
export interface NativeInputProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'value' | 'type'>, TextValueProps {
  type?: 'text' | 'password' | 'search' | 'email' | 'url' | 'tel' | 'number'
}

/** Native input events, selection and undo remain available. Supply a label directly or with Field. */
export function NativeInput(props: NativeInputProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'value',
    'defaultValue',
    'onValueChange',
    'ref',
    'onInput',
  ])

  let input!: HTMLInputElement
  const update = bindTextControl(local, () => input)

  return (
    <input
      type="text"
      {...fieldAttributes(props)}
      {...rest}
      ref={(node) => {
        input = node
        assignRef(local.ref, node)
      }}
      onInput={(event) => {
        update()
        callHandler(local.onInput, event)
      }}
    />
  )
}
