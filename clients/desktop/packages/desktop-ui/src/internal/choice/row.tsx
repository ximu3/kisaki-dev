/** @fileoverview Labeled choices use the native control and one shared first-line alignment. */

import { children, Show } from 'solid-js'
import type { JSX } from 'solid-js'
import styles from './styles.module.css'

/** A supplied label makes the complete row clickable. A bare control keeps external labeling available. */
export function ChoiceRow(props: { label?: JSX.Element; children: JSX.Element }): JSX.Element {
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
