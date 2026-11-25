import type { JSX } from '@solidjs/web'
import styles from './styles.module.css'

export interface IconProps {
  path: string
  class?: string | undefined
  label?: string | undefined
}

export function Icon(props: IconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      class={[styles.glyph, props.class]}
      role={props.label ? 'img' : undefined}
      aria-label={props.label}
      aria-hidden={props.label ? undefined : 'true'}
    >
      <path d={props.path} />
    </svg>
  )
}
