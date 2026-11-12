/** @fileoverview A focusable viewport exposes the native scroll container. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'

/**
 * Native scrolling viewport attributes and allowed visible scroll axes.
 *
 * Callers provide a label when exposing it as a keyboard region.
 */
export interface ScrollAreaProps extends JSX.HTMLAttributes<HTMLDivElement> {
  orientation?: 'vertical' | 'horizontal' | 'both'
}

/**
 * Renders a native scrolling viewport with keyboard entry by default and browser-owned wheel and
 * selection behavior.
 */
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
