/** @fileoverview Native checkbox submission with explicit indeterminate presentation. */

import { createEffect, onMount, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { bindCheckedControl } from '../../internal/checked-control'
import type { CheckedValueProps } from '../../internal/checked-control'
import { Icon, mdiCheck, mdiMinus } from '../../internal/icon/icon'
import { ChoiceRow } from '../../internal/choice/row'
import styles from './styles.module.css'

/** checked determines form submission; indeterminate is a separately controlled visual state. */
export interface CheckboxProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked'>, CheckedValueProps {
  label?: JSX.Element
  indeterminate?: boolean
}

/** Label directly or through Field; native required, fieldset and FormData rules remain in force. */
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
        <Icon path={mdiCheck} class={styles.check} />
        <Icon path={mdiMinus} class={styles.mixed} />
      </span>
    </ChoiceRow>
  )
}
