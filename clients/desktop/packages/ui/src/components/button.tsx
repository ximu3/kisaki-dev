/**
 * @fileoverview Provides a themed Solid button while preserving native attributes,
 * keyboard behavior and form semantics.
 */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'

/** Native button attributes; disabled, keyboard and form semantics stay with the browser. */
export type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement>

/** Render a native button with shared visual tokens; form submission is opt-in. */
export function Button(props: ButtonProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'type', 'children'])

  return (
    <button type={local.type ?? 'button'} class={`kisaki-button ${local.class ?? ''}`} {...rest}>
      {local.children}
    </button>
  )
}
