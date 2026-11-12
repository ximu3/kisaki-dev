/** @fileoverview Plain single-line editing with native text semantics. */

import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import surface from '../../internal/input-surface.module.css'
import { NativeInput } from './native'
import type { NativeInputProps } from './native'

/**
 * Single-line native text-input attributes.
 *
 * Numeric, date and color editing use their dedicated controls.
 */
export interface InputProps extends Omit<NativeInputProps, 'type'> {
  type?: 'text' | 'password' | 'search' | 'email' | 'url' | 'tel'
}

/** Renders native text editing with the shared input surface and optional Field associations. */
export function Input(props: InputProps): JSX.Element {
  return (
    <NativeInput {...props} class={classes(surface.surface, surface.singleLine, props.class)} />
  )
}
