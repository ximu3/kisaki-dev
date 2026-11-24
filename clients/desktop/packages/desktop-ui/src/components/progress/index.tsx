import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import styles from './styles.module.css'

export type ProgressProps = JSX.ProgressHTMLAttributes<HTMLProgressElement>

export function Progress(props: ProgressProps): JSX.Element {
  const rest = omit(props, 'class', 'value')

  return <progress max={1} {...rest} value={props.value} class={[styles.root, props.class]} />
}
