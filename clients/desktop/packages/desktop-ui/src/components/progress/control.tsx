/** @fileoverview Native progress elements represent determinate and indeterminate work. */

import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import styles from './styles.module.css'

/**
 * Native progress attributes requiring a caller-supplied accessible label.
 *
 * Omitting value represents indeterminate work.
 */
export type ProgressProps = JSX.ProgressHTMLAttributes<HTMLProgressElement>

/** Renders supplied progress with a default maximum of 1, independently of operation success. */
export function Progress(props: ProgressProps): JSX.Element {
  const rest = omit(props, 'class', 'value')

  return <progress max={1} {...rest} value={props.value} class={[styles.root, props.class]} />
}
