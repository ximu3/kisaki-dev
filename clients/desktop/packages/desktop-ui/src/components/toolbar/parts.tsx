/** @fileoverview Aligns and wraps related query controls and actions. */

import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import styles from './styles.module.css'

/** Layout attributes for a toolbar with an optional band around its rows. */
export interface ToolbarProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Frames the fixed scope and query rows above a work surface. */
  band?: boolean
}

/** Aligns related controls and allows them to wrap within the available width. */
export function Toolbar(props: ToolbarProps): JSX.Element {
  const rest = omit(props, 'class', 'band')
  return <div {...rest} class={[styles.bar, props.class]} data-band={props.band || undefined} />
}

/** Presents one related group of native inputs and actions in tab order. */
export function ToolbarRow(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const rest = omit(props, 'class')
  return <div {...rest} class={[styles.row, props.class]} />
}
