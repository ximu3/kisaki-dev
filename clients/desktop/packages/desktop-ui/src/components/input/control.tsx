/** @fileoverview Plain single-line editing with native text semantics. */

import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import surface from '../../internal/input-surface.module.css'
import { NativeInput } from './native'
import type { NativeInputProps } from './native'

/** Numeric, calendar and color editing use their dedicated controls in this family. */
export interface InputProps extends Omit<NativeInputProps, 'type'> {
  type?: 'text' | 'password' | 'search' | 'email' | 'url' | 'tel'
}

/** Native text editing accepts direct labels or a surrounding Field. */
export function Input(props: InputProps): JSX.Element {
  return (
    <NativeInput {...props} class={classes(surface.surface, surface.singleLine, props.class)} />
  )
}
