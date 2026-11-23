/** @fileoverview Empty content combines a heading, description and optional action. */

import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
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
  const rest = omit(props, 'class', 'heading', 'description', 'icon', 'children')

  return (
    <div {...rest} class={[styles.root, props.class]}>
      <div class={styles.icon} aria-hidden="true">
        {props.icon}
      </div>
      <h3 class={styles.heading}>{props.heading}</h3>
      <p class={styles.description}>{props.description}</p>
      <div class={styles.actions}>{props.children}</div>
    </div>
  )
}
