/** @fileoverview alert presentation using native document semantics. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'

/** Alert tone and announcement are separate; choose role=alert only for an urgent new message. */
export interface AlertProps extends JSX.HTMLAttributes<HTMLDivElement> {
  tone?: 'info' | 'success' | 'warning' | 'destructive'
}

/** A persistent inline message whose text and actions are owned by the caller. */
export function Alert(props: AlertProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'tone'])

  return (
    <div {...rest} class={classes(styles.root, local.class)} data-tone={local.tone ?? 'info'} />
  )
}
