/** @fileoverview A stationary status slot contains the animated MDI loading glyph. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import { Icon, mdiLoading } from '../../internal/icon/glyph'
import styles from './styles.module.css'

/**
 * Busy-indicator attributes with an optional accessible status label.
 *
 * Without a label the indicator is decorative.
 */
export interface SpinnerProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  label?: string
}

/** Renders an indeterminate busy indicator that remains static when reduced motion is requested. */
export function Spinner(props: SpinnerProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'label'])

  return (
    <span
      {...rest}
      class={classes(styles.root, local.class)}
      role={local.label ? 'status' : undefined}
      aria-label={local.label}
      aria-hidden={local.label ? undefined : true}
    >
      <Icon path={mdiLoading} class={styles.glyph} />
    </span>
  )
}
