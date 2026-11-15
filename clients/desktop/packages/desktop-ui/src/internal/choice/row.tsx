/** @fileoverview Labeled choices use the native control and one shared first-line alignment. */

import { children, Show } from 'solid-js'
import type { JSX } from 'solid-js'
import styles from './styles.module.css'

/**
 * Wraps a control in a clickable native label row when label content is supplied.
 *
 * A bare control retains external labeling support.
 */
export function ChoiceRow(props: { label?: JSX.Element; children: JSX.Element }): JSX.Element {
  /** Resolved child control retained by the surrounding choice-row presentation. */
  const control = children(() => props.children)

  return (
    <Show when={props.label !== undefined} fallback={control()}>
      <label class={styles.row}>
        <span class={styles.control}>{control()}</span>
        <span class={styles.label}>{props.label}</span>
      </label>
    </Show>
  )
}
