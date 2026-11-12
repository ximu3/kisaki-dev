/** @fileoverview Native action buttons with compact desktop variants and explicit busy state. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
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
  const [local, rest] = splitProps(props, [
    'class',
    'variant',
    'size',
    'busy',
    'disabled',
    'children',
  ])

  return (
    <button
      type="button"
      {...rest}
      class={classes(styles.root, local.class)}
      data-variant={local.variant ?? 'default'}
      data-size={local.size ?? 'default'}
      disabled={local.disabled || local.busy}
      aria-busy={local.busy || undefined}
    >
      {local.children}
    </button>
  )
}
