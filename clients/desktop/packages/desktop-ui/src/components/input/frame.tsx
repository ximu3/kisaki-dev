/** @fileoverview The shared field border contains the native editor and its independent action column. */

import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import surface from '../../internal/input-surface.module.css'
import styles from './styles.module.css'

interface InputFrameProps {
  children: JSX.Element
  class?: string | undefined
  style?: JSX.HTMLAttributes<HTMLDivElement>['style']
  open?: boolean
}

/** Opening a picker keeps its field visibly active while the picker owns keyboard focus. */
export function InputFrame(props: InputFrameProps): JSX.Element {
  return (
    <div
      class={classes(surface.surface, styles.frame, props.class)}
      style={props.style}
      data-open={props.open || undefined}
    >
      {props.children}
    </div>
  )
}
