/** @fileoverview A native checkbox with switch semantics and compact track presentation. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { bindCheckedControl } from '../../internal/checked-control'
import type { CheckedValueProps } from '../../internal/checked-control'
import { ChoiceRow } from '../../internal/choice/row'
import styles from './styles.module.css'

/**
 * Two-state switch attributes with checked-state ownership and an optional inline label.
 *
 * The caller supplies a stable accessible name.
 */
export interface SwitchProps
  extends
    Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'role'>,
    CheckedValueProps {
  label?: JSX.Element
}

/**
 * Renders switch semantics on a native checkbox, retaining Space activation, form submission and
 * reset.
 */
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
  /** Checked-state dispatcher shared by the switch owner and native form integration. */
  const update = bindCheckedControl(local, () => input)

  return (
    <ChoiceRow label={local.label}>
      <input
        {...fieldAttributes(props, () => local.label)}
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
