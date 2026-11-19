/** @fileoverview Native progress elements represent determinate and indeterminate work. */

import { createRenderEffect, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, classes } from '../../internal/dom'
import styles from './styles.module.css'

/**
 * Native progress attributes requiring a caller-supplied accessible label.
 *
 * Omitting value represents indeterminate work.
 */
export type ProgressProps = JSX.ProgressHTMLAttributes<HTMLProgressElement>

/** Renders supplied progress with a default maximum of 1, independently of operation success. */
export function Progress(props: ProgressProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'value', 'ref'])

  return (
    <progress
      max={1}
      {...rest}
      ref={(node) => {
        createRenderEffect(() => {
          if (local.value === undefined) {
            node.removeAttribute('value')
          } else {
            node.setAttribute('value', String(local.value))
          }
        })
        assignRef(local.ref, node)
      }}
      class={classes(styles.root, local.class)}
    />
  )
}
