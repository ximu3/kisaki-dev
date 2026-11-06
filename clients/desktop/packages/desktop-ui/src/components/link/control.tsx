/** @fileoverview link presentation using native document semantics. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import type { ButtonSize, ButtonVariant } from '../button/control'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'
import buttonStyles from '../button/styles.module.css'

/** Navigation link with optional button appearance; href and browser navigation stay native. */
export interface LinkProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

/** Use href for navigation and an accessible name for icon-only content. */
export function Link(props: LinkProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'variant', 'size'])

  return (
    <a
      {...rest}
      class={classes(local.variant ? buttonStyles.root : styles.root, local.class)}
      data-variant={local.variant}
      data-size={local.size ?? 'default'}
    />
  )
}
