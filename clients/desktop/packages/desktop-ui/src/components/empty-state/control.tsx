/** @fileoverview empty-state presentation using native document semantics. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'

/** Empty content is distinct from loading and failure; actions are supplied as children. */
export interface EmptyStateProps extends JSX.HTMLAttributes<HTMLDivElement> {
  heading: JSX.Element
  description?: JSX.Element
  icon?: JSX.Element
}

/** Present a named empty region with the caller's applicable next action. */
export function EmptyState(props: EmptyStateProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'heading', 'description', 'icon', 'children'])

  return (
    <div {...rest} class={classes(styles.root, local.class)}>
      <div class={styles.icon} aria-hidden="true">
        {local.icon}
      </div>
      <h3 class={styles.heading}>{local.heading}</h3>
      <p class={styles.description}>{local.description}</p>
      <div class={styles.actions}>{local.children}</div>
    </div>
  )
}
