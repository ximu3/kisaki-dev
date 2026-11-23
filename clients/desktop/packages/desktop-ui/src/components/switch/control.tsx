/** @fileoverview A native checkbox with switch semantics and compact track presentation. */

import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import type { ControlSize } from '../../internal/control/size'
import { callHandler } from '../../internal/dom'
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
    Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'role' | 'size'>,
    CheckedValueProps {
  label?: JSX.Element
  size?: ControlSize | undefined
}

/**
 * Renders switch semantics on a native checkbox, retaining Space activation, form submission and
 * reset.
 */
export function Switch(props: SwitchProps): JSX.Element {
  const rest = omit(
    props,
    'checked',
    'defaultChecked',
    'label',
    'size',
    'onCheckedChange',
    'class',
    'ref',
    'onChange',
  )

  let input!: HTMLInputElement
  /** Checked-state dispatcher shared by the switch owner and native form integration. */
  const update = bindCheckedControl(props, () => input)

  return (
    <ChoiceRow label={props.label} size={props.size}>
      <input
        {...fieldAttributes(props, () => props.label)}
        {...rest}
        type="checkbox"
        role="switch"
        data-size={props.size ?? 'default'}
        ref={[
          (node) => {
            input = node
          },
          props.ref,
        ]}
        class={[styles.root, props.class]}
        onChange={(event) => {
          update()
          callHandler(props.onChange, event)
        }}
      />
    </ChoiceRow>
  )
}
