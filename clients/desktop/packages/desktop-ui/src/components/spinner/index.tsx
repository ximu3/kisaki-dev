import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { mdiLoading } from '@mdi/js'
import { Icon } from '../icon'
import styles from './styles.module.css'

export interface SpinnerProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  label?: string
}

export function Spinner(props: SpinnerProps): JSX.Element {
  const rest = omit(props, 'class', 'label')

  return (
    <span
      {...rest}
      class={[styles.root, props.class]}
      role={props.label ? 'status' : undefined}
      aria-label={props.label}
      aria-hidden={props.label ? undefined : 'true'}
    >
      <Icon path={mdiLoading} class={styles.glyph} />
    </span>
  )
}
