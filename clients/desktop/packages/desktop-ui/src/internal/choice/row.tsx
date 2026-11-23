import { children, Show } from 'solid-js'
import type { JSX } from '@solidjs/web'
import type { ControlSize } from '../control/size'
import styles from './styles.module.css'

/**
 * Wraps a control in a clickable native label row when label content is supplied.
 *
 * A bare control retains external labeling support.
 */
export function ChoiceRow(props: {
  label?: JSX.Element
  size?: ControlSize | undefined
  children: JSX.Element
}): JSX.Element {
  const control = children(() => props.children)

  return (
    <Show when={props.label !== undefined} fallback={control()}>
      <label class={styles.row} data-size={props.size ?? 'default'}>
        <span class={styles.control}>{control()}</span>
        <span class={styles.label}>{props.label}</span>
      </label>
    </Show>
  )
}
