import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import styles from './styles.module.css'

/**
 * Divider attributes with horizontal or vertical geometry and optional separator semantics.
 *
 * The default is decorative.
 */
export interface SeparatorProps extends JSX.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
  decorative?: boolean
}

/** Separates adjacent content without adding a keyboard stop. */
export function Separator(props: SeparatorProps): JSX.Element {
  const rest = omit(props, 'class', 'orientation', 'decorative')

  return (
    <div
      {...rest}
      class={[styles.root, props.class]}
      data-orientation={props.orientation ?? 'horizontal'}
      role={props.decorative === false ? 'separator' : 'none'}
      aria-orientation={
        props.decorative === false ? (props.orientation ?? 'horizontal') : undefined
      }
    />
  )
}
