import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import styles from './styles.module.css'

export interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  tone?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
}

export function Badge(props: BadgeProps): JSX.Element {
  const rest = omit(props, 'class', 'tone')

  return <span {...rest} class={[styles.root, props.class]} data-tone={props.tone ?? 'default'} />
}
