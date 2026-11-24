import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import type { ControlSize } from '../../internal/control/size'
import surface from '../../internal/input-surface.module.css'
import { NativeInput, type NativeInputProps } from './native'

export interface InputProps extends Omit<NativeInputProps, 'type'> {
  type?: 'text' | 'password' | 'search' | 'email' | 'url' | 'tel'
  size?: ControlSize | undefined
}

export function Input(props: InputProps): JSX.Element {
  const rest = omit(props, 'size', 'class')

  return (
    <NativeInput
      {...rest}
      class={[surface.surface, surface.singleLine, props.class]}
      data-size={props.size ?? 'default'}
    />
  )
}
