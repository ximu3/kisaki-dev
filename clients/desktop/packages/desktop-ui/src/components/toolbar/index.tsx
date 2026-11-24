import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import styles from './styles.module.css'

export interface ToolbarProps extends JSX.HTMLAttributes<HTMLDivElement> {
  band?: boolean
}

export function Toolbar(props: ToolbarProps): JSX.Element {
  const rest = omit(props, 'class', 'band')
  return <div {...rest} class={[styles.bar, props.class]} data-band={props.band || undefined} />
}

export function ToolbarRow(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const rest = omit(props, 'class')
  return <div {...rest} class={[styles.row, props.class]} />
}
