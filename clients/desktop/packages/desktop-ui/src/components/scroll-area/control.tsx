/** @fileoverview scroll-area presentation using native document semantics. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'

/** Native scroll container; give a label when exposing it as a keyboard region. */
export interface ScrollAreaProps extends JSX.HTMLAttributes<HTMLDivElement> {
  orientation?: 'vertical' | 'horizontal' | 'both'
}

/** Preserve browser scrolling, selection and wheel behavior, including horizontal table access. */
export function ScrollArea(props: ScrollAreaProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'orientation'])

  return (
    <div
      tabIndex={0}
      {...rest}
      class={classes(styles.root, local.class)}
      data-orientation={local.orientation ?? 'both'}
    />
  )
}
