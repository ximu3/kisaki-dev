/** @fileoverview Compact inline feedback with a distinct status icon and caller-owned actions. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import { StatusIcon } from '../../internal/icon/glyph'
import styles from './styles.module.css'

/**
 * Inline feedback attributes and semantic tone.
 *
 * Tone and announcement are independent; callers choose role=alert only for an urgent new message.
 */
export interface AlertProps extends JSX.HTMLAttributes<HTMLDivElement> {
  tone?: 'info' | 'success' | 'warning' | 'destructive'
}

/** Renders inline feedback on a neutral surface with status conveyed by its icon and content. */
export function Alert(props: AlertProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'tone', 'children'])

  return (
    <div {...rest} class={classes(styles.root, local.class)} data-tone={local.tone ?? 'info'}>
      <StatusIcon type={local.tone ?? 'info'} class={styles.icon} />
      <div class={styles.content}>{local.children}</div>
    </div>
  )
}
