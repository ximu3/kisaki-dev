import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import styles from './styles.module.css'

export interface ScrollAreaProps extends JSX.HTMLAttributes<HTMLDivElement> {
  orientation?: 'vertical' | 'horizontal' | 'both'
}

export function ScrollArea(props: ScrollAreaProps): JSX.Element {
  const rest = omit(props, 'class', 'orientation')

  return (
    <div
      tabindex={0}
      {...rest}
      class={[styles.root, props.class]}
      data-orientation={props.orientation ?? 'both'}
    />
  )
}
