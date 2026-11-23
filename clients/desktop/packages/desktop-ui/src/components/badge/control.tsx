/** @fileoverview Compact labels communicate status with text and semantic color. */

import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import styles from './styles.module.css'

/** Compact text-label attributes with a presentation-only semantic tone. */
export interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  tone?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
}

/** Renders a compact label without adding interaction or live announcement behavior. */
export function Badge(props: BadgeProps): JSX.Element {
  const rest = omit(props, 'class', 'tone')

  return <span {...rest} class={[styles.root, props.class]} data-tone={props.tone ?? 'default'} />
}
