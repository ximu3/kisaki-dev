/** @fileoverview Native single-line editing with field associations and reset synchronization. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { bindTextControl } from '../../internal/text-control'
import type { TextValueProps } from '../../internal/text-control'

/**
 * Native single-line input attributes and shared text-value binding for dedicated input controls.
 */
export interface NativeInputProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'value' | 'type'>, TextValueProps {
  type?: 'text' | 'password' | 'search' | 'email' | 'url' | 'tel' | 'number'
}

/**
 * Binds native editing, form reset and optional Field associations to the caller's text-value
 * model.
 *
 * Native events, selection and undo remain available.
 */
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
