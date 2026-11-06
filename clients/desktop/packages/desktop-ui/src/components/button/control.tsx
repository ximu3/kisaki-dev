/** @fileoverview Native action buttons with compact desktop variants and explicit busy state. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'

/** Visual purpose; navigation remains the Link family's responsibility. */
export type ButtonVariant =
  'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'text'

/** Heights follow the inherited interface scale; icon sizes retain a square hit area. */
export type ButtonSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'

/** Supply an accessible name for icon-only content. Busy disables new activation. */
export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize

  busy?: boolean
}

/** A native button; defaults to type=button so actions do not accidentally submit a form. */
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
