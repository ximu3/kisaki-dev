import { createEffect, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import type { ControlSize } from '../../internal/control/size'
import { callHandler } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { bindCheckedControl, type CheckedValueProps } from '../../internal/checked-control'
import { mdiCheck, mdiMinus } from '@mdi/js'
import { Icon } from '../icon'
import { ChoiceRow } from '../../internal/choice/row'
import styles from './styles.module.css'

export interface CheckboxProps
  extends
    Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'size'>,
    CheckedValueProps {
  label?: JSX.Element
  size?: ControlSize | undefined
  indeterminate?: boolean
}

export function Checkbox(props: CheckboxProps): JSX.Element {
  const rest = omit(
    props,
    'checked',
    'defaultChecked',
    'onCheckedChange',
    'indeterminate',
    'label',
    'size',
    'class',
    'ref',
    'onChange',
  )

  let input!: HTMLInputElement
  const update = bindCheckedControl(props, () => input)

  createEffect(
    () => !!props.indeterminate,
    (indeterminate) => {
      input.indeterminate = indeterminate
    },
  )

  return (
    <ChoiceRow label={props.label} size={props.size}>
      <span class={styles.container} data-size={props.size ?? 'default'}>
        <input
          {...fieldAttributes(props, () => props.label)}
          {...rest}
          type="checkbox"
          ref={[
            (node) => {
              input = node
            },
            props.ref,
          ]}
          class={[styles.root, props.class]}
          onChange={(event) => {
            update()
            input.indeterminate = !!props.indeterminate
            callHandler(props.onChange, event)
          }}
        />
        <Icon path={mdiCheck} class={styles.check} />
        <Icon path={mdiMinus} class={styles.mixed} />
      </span>
    </ChoiceRow>
  )
}
