/** @fileoverview Native action buttons with compact desktop variants and explicit busy state. */

import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import type { ActionSize, ActionVariant } from '../../internal/action/types'
import styles from '../../internal/action/styles.module.css'

/**
 * Native action-button attributes, visual size and variant, and explicit busy state.
 *
 * Callers supply an accessible name for icon-only content. Busy disables new activation.
 */
export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionVariant
  size?: ActionSize

  busy?: boolean
}

/**
 * Renders a native action button, defaulting to type=button and disabling activation while busy.
 */
export function Button(props: ButtonProps): JSX.Element {
  const rest = omit(props, 'class', 'variant', 'size', 'busy', 'disabled', 'children')

  return (
    <button
      type="button"
      {...rest}
      class={[styles.root, props.class]}
      data-variant={props.variant ?? 'default'}
      data-size={props.size ?? 'default'}
      disabled={props.disabled || props.busy}
      aria-busy={props.busy ? 'true' : undefined}
    >
      {props.children}
    </button>
  )
}
