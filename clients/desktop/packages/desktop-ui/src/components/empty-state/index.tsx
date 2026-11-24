import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import styles from './styles.module.css'

export interface EmptyStateProps extends JSX.HTMLAttributes<HTMLDivElement> {
  heading: JSX.Element
  description?: JSX.Element
  icon?: JSX.Element
}

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
