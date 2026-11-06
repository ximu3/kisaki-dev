/** @fileoverview Plain single-line editing with native text semantics. */

import type { JSX } from 'solid-js'
import { NativeInput } from './native'
import type { NativeInputProps } from './native'

/** Numeric, calendar and color editing use their dedicated controls in this family. */
export interface InputProps extends Omit<NativeInputProps, 'type'> {
  type?: 'text' | 'password' | 'search' | 'email' | 'url' | 'tel'
}

export function Input(props: InputProps): JSX.Element {
  return <NativeInput {...props} />
}
