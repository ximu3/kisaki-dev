import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { bindTextControl, type TextValueProps } from '../../internal/text-control'

export interface NativeInputProps
  extends
    Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'value' | 'type' | 'size'>,
    TextValueProps {
  type?: 'text' | 'password' | 'search' | 'email' | 'url' | 'tel' | 'number'
  htmlSize?: JSX.InputHTMLAttributes<HTMLInputElement>['size']
}

export function NativeInput(props: NativeInputProps): JSX.Element {
  const rest = omit(props, 'value', 'defaultValue', 'onValueChange', 'htmlSize', 'ref', 'onInput')

  let input!: HTMLInputElement
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
