/** @fileoverview Native navigation links can use the shared action appearance. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import type { ActionSize, ActionVariant } from '../../internal/action/types'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'
import actionStyles from '../../internal/action/styles.module.css'

/** Navigation link with optional button appearance; href and browser navigation stay native. */
export interface LinkProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ActionVariant
  size?: ActionSize
}

/** Use href for navigation and an accessible name for icon-only content. */
export function Link(props: LinkProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'variant', 'size'])

  return (
    <a
      {...rest}
      class={classes(local.variant ? actionStyles.root : styles.root, local.class)}
      data-variant={local.variant}
      data-size={local.size ?? 'default'}
    />
  )
}
