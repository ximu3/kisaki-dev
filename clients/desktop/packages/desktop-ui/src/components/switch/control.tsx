/** @fileoverview A native checkbox with switch semantics and compact track presentation. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { bindCheckedControl } from '../../internal/checked-control'
import type { CheckedValueProps } from '../../internal/checked-control'
import { ChoiceRow } from '../../internal/choice/row'
import styles from './styles.module.css'

/** A two-state form control; caller supplies its stable accessible name. */
export interface SwitchProps
  extends
    Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'role'>,
    CheckedValueProps {
  label?: JSX.Element
}

/** Native Space activation, form submission and reset follow the checkbox contract. */
export function Switch(props: SwitchProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'checked',
    'defaultChecked',
    'label',
    'onCheckedChange',
    'class',
    'ref',
    'onChange',
  ])

  let input!: HTMLInputElement
  const update = bindCheckedControl(local, () => input)

  return (
    <ChoiceRow label={local.label}>
      <input
        {...fieldAttributes()}
        {...rest}
        type="checkbox"
        role="switch"
        ref={(node) => {
          input = node
          assignRef(local.ref, node)
        }}
        class={classes(styles.root, local.class)}
        onChange={(event) => {
          update()
          callHandler(local.onChange, event)
        }}
      />
    </ChoiceRow>
  )
}
