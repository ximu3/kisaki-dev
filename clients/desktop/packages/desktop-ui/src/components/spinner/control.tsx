/** @fileoverview spinner presentation using native document semantics. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'

/** The label supplies the accessible status; omit it for a decorative indicator beside existing text. */
export interface SpinnerProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  label?: string
}

/** Indeterminate progress; reduced motion retains a static busy indicator. */
export function Spinner(props: SpinnerProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'label'])

  return (
    <span
      {...rest}
      class={classes(styles.root, local.class)}
      role={local.label ? 'status' : undefined}
      aria-label={local.label}
      aria-hidden={local.label ? undefined : true}
    />
  )
}
