/** @fileoverview A stationary status slot contains the animated Lucide loading glyph. */

import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Icon, LoaderCircle } from '../../internal/icon/glyph'
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
  const rest = omit(props, 'class', 'label')

  return (
    <span
      {...rest}
      class={[styles.root, props.class]}
      role={props.label ? 'status' : undefined}
      aria-label={props.label}
      aria-hidden={props.label ? undefined : 'true'}
    >
      <Icon icon={LoaderCircle} class={styles.glyph} />
    </span>
  )
}
