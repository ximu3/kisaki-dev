/** @fileoverview Native checkbox submission with explicit indeterminate presentation. */

import { createEffect, onMount, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { bindCheckedControl } from '../../internal/checked-control'
import type { CheckedValueProps } from '../../internal/checked-control'
import { Icon, Check, Minus } from '../../internal/icon/glyph'
import { ChoiceRow } from '../../internal/choice/row'
import styles from './styles.module.css'

/**
 * Native checkbox attributes, checked-state ownership and optional mixed presentation.
 *
 * Checked controls form submission; indeterminate is a separate visual state.
 */
export interface CheckboxProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked'>, CheckedValueProps {
  label?: JSX.Element
  indeterminate?: boolean
}

/**
 * Renders a native checkbox with optional inline labeling and Field associations.
 *
 * Native required, fieldset and form-submission behavior remains available.
 */
export function Checkbox(props: CheckboxProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'checked',
    'defaultChecked',
    'onCheckedChange',
    'indeterminate',
    'label',
    'class',
    'ref',
    'onChange',
  ])

  let input!: HTMLInputElement
  /** Checked-state dispatcher shared by the checkbox owner and native form integration. */
  const update = bindCheckedControl(local, () => input)

  onMount(() =>
    createEffect(() => {
      input.indeterminate = !!local.indeterminate
    }),
  )

  return (
    <ChoiceRow label={local.label}>
      <span class={styles.container}>
        <input
          {...fieldAttributes(props, () => local.label)}
          {...rest}
          type="checkbox"
          ref={(node) => {
            input = node
            assignRef(local.ref, node)
          }}
          class={classes(styles.root, local.class)}
          onChange={(event) => {
            update()
            input.indeterminate = !!local.indeterminate
            callHandler(local.onChange, event)
          }}
        />
        <Icon icon={Check} class={styles.check} />
        <Icon icon={Minus} class={styles.mixed} />
      </span>
    </ChoiceRow>
  )
}
