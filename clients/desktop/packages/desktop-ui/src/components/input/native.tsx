/** @fileoverview Native single-line editing with field associations and reset synchronization. */

import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { bindTextControl } from '../../internal/text-control'
import type { TextValueProps } from '../../internal/text-control'

/**
 * Native single-line input attributes and shared text-value binding for dedicated input controls.
 */
export interface NativeInputProps
  extends
    Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'value' | 'type' | 'size'>,
    TextValueProps {
  type?: 'text' | 'password' | 'search' | 'email' | 'url' | 'tel' | 'number'
  /** Native size attribute in characters for input types that support it. */
  htmlSize?: JSX.InputHTMLAttributes<HTMLInputElement>['size']
}

/**
 * Binds native editing, form reset and optional Field associations to the caller's text-value
 * model.
 *
 * Native events, selection and undo remain available.
 */
export function NativeInput(props: NativeInputProps): JSX.Element {
  const rest = omit(props, 'value', 'defaultValue', 'onValueChange', 'htmlSize', 'ref', 'onInput')

  let input!: HTMLInputElement
  /** Text-value dispatcher shared by the input owner and native form integration. */
  const update = bindTextControl(props, () => input)

  return (
    <input
      type="text"
      {...fieldAttributes(props)}
      {...rest}
      size={props.htmlSize}
      ref={[
        (node) => {
          input = node
        },
        props.ref,
      ]}
      onInput={(event) => {
        update()
        callHandler(props.onInput, event)
      }}
    />
  )
}
