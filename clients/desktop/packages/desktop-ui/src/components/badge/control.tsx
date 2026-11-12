/** @fileoverview Compact labels communicate status with text and semantic color. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'

/** Compact text-label attributes with a presentation-only semantic tone. */
export interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  tone?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
}

/** Renders a compact label without adding interaction or live announcement behavior. */
export function Badge(props: BadgeProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'tone'])

  return (
    <span
      {...rest}
      class={classes(styles.root, local.class)}
      data-tone={local.tone ?? 'secondary'}
    />
  )
}
