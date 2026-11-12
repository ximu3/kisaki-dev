/** @fileoverview Native progress elements represent determinate and indeterminate work. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'

/**
 * Native progress attributes requiring a caller-supplied accessible label.
 *
 * Omitting value represents indeterminate work.
 */
export type ProgressProps = JSX.ProgressHTMLAttributes<HTMLProgressElement>

/** Renders supplied progress with a default maximum of 1, independently of operation success. */
export function Progress(props: ProgressProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <progress max={1} {...rest} class={classes(styles.root, local.class)} />
}
