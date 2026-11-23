/** @fileoverview Compact inline feedback with a distinct status icon and caller-owned actions. */

import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
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
  const rest = omit(props, 'class', 'tone', 'children')

  return (
    <div {...rest} class={[styles.root, props.class]} data-tone={props.tone ?? 'info'}>
      <StatusIcon type={props.tone ?? 'info'} class={styles.icon} />
      <div class={styles.content}>{props.children}</div>
    </div>
  )
}
