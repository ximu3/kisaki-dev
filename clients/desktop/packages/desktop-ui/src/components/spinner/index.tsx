import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Icon, LoaderCircle } from '../../internal/icon/glyph'
import styles from './styles.module.css'

export interface SpinnerProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  /** Accessible status label. Omit it for a decorative indicator. */
  label?: string
}

/** Remains still when the user requests reduced motion. */
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
      <Icon icon={LoaderCircle} class={styles.glyph} />
    </span>
  )
}
