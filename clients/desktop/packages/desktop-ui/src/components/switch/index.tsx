import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import type { ControlSize } from '../../internal/control/size'
import { callHandler } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { bindCheckedControl, type CheckedValueProps } from '../../internal/checked-control'
import { ChoiceRow } from '../../internal/choice/row'
import styles from './styles.module.css'

export interface SwitchProps
  extends
    Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'role' | 'size'>,
    CheckedValueProps {
  label?: JSX.Element
  size?: ControlSize | undefined
}

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
