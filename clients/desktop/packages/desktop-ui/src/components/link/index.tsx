import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import type { ActionSize, ActionVariant } from '../../internal/action/types'
import styles from './styles.module.css'
import actionStyles from '../../internal/action/styles.module.css'

export interface LinkProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ActionVariant
  size?: ActionSize
}

export function Link(props: LinkProps): JSX.Element {
  const rest = omit(props, 'class', 'variant', 'size')

  return (
    <a
      {...rest}
      class={[props.variant ? actionStyles.root : styles.root, props.class]}
      data-variant={props.variant}
      data-size={props.size ?? 'default'}
    />
  )
}
