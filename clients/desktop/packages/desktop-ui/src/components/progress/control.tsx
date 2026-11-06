/** @fileoverview progress presentation using native document semantics. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'

/** Native progress attributes; omit value for indeterminate work and provide a label. */
export type ProgressProps = JSX.ProgressHTMLAttributes<HTMLProgressElement>

/** Render the actual supplied progress without inferring completion or operation success. */
export function Progress(props: ProgressProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <progress max={1} {...rest} class={classes(styles.root, local.class)} />
}
