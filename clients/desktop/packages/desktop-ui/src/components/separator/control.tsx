/** @fileoverview Decorative and semantic dividers share horizontal and vertical geometry. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'

/** Decorative by default; semantic separators expose their orientation. */
export interface SeparatorProps extends JSX.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
  decorative?: boolean
}

/** Separate adjacent content without adding a keyboard stop. */
export function Separator(props: SeparatorProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'orientation', 'decorative'])

  return (
    <div
      {...rest}
      class={classes(styles.root, local.class)}
      data-orientation={local.orientation ?? 'horizontal'}
      role={local.decorative === false ? 'separator' : 'none'}
      aria-orientation={
        local.decorative === false ? (local.orientation ?? 'horizontal') : undefined
      }
    />
  )
}
