import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import type { ActionSize, ActionVariant } from '../../internal/action/types'
import styles from '../../internal/action/styles.module.css'

export type { ControlSize } from '../../internal/control/size'
export type {
  ActionSize as ButtonSize,
  ActionVariant as ButtonVariant,
} from '../../internal/action/types'

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionVariant
  size?: ActionSize

  busy?: boolean
}

export function Button(props: ButtonProps): JSX.Element {
  const rest = omit(props, 'class', 'variant', 'size', 'busy', 'disabled', 'children')

  return (
    <button
      type="button"
      {...rest}
      class={[styles.root, props.class]}
      data-variant={props.variant ?? 'default'}
      data-size={props.size ?? 'default'}
      disabled={props.disabled || props.busy}
      aria-busy={props.busy ? 'true' : undefined}
    >
      {props.children}
    </button>
  )
}
