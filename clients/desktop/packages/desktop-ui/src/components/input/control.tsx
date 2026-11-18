/** @fileoverview Plain single-line editing with native text semantics. */

import { splitProps, type JSX } from 'solid-js'
import type { ControlSize } from '../../internal/control/size'
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
  /** Selects the field height, text size and graphics together. */
  size?: ControlSize | undefined
}

/** Renders native text editing with the shared input surface and optional Field associations. */
export function Input(props: InputProps): JSX.Element {
  const [local, rest] = splitProps(props, ['size', 'class'])

  return (
    <NativeInput
      {...rest}
      class={classes(surface.surface, surface.singleLine, local.class)}
      data-size={local.size ?? 'default'}
    />
  )
}
