import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { StatusIcon } from '../../internal/icon/status'
import styles from './styles.module.css'

export interface AlertProps extends JSX.HTMLAttributes<HTMLDivElement> {
  tone?: 'info' | 'success' | 'warning' | 'destructive'
}

export function Alert(props: AlertProps): JSX.Element {
  const rest = omit(props, 'class', 'tone', 'children')

  return (
    <div {...rest} class={[styles.root, props.class]} data-tone={props.tone ?? 'info'}>
      <StatusIcon type={props.tone ?? 'info'} class={styles.icon} />
      <div class={styles.content}>{props.children}</div>
    </div>
  )
}
