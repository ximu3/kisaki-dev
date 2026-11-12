/** @fileoverview Empty content combines a heading, description and optional action. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'

/**
 * Empty-content heading, optional explanation and decorative icon, with actions supplied as
 * children.
 */
export interface EmptyStateProps extends JSX.HTMLAttributes<HTMLDivElement> {
  heading: JSX.Element
  description?: JSX.Element
  icon?: JSX.Element
}

/** Presents empty content with the caller's explanation and applicable next actions. */
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
