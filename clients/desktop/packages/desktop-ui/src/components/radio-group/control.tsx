/** @fileoverview Native radio groups share one value and reset boundary. */

import { createContext, createUniqueId, omit, useContext } from 'solid-js'
import type { Accessor } from 'solid-js'
import type { JSX } from '@solidjs/web'
import type { ControlSize } from '../../internal/control/size'
import { callHandler } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { bindRadioSelection } from '../../internal/choice/radio'
import { ChoiceRow } from '../../internal/choice/row'
import styles from './styles.module.css'

/** Native form identity and selection ownership shared by a radio group's options. */
const RadioContext = createContext<{
  /** Reads the shared native form-field name for this radio group. */
  name: Accessor<string>
  /** Reads the group's controlled or locally owned selected value. */
  value: Accessor<string>
  /** Requests selection of one option through the group's value owner. */
  change: (value: string) => void
  /** Reads the required state propagated to the group's native options. */
  required: Accessor<boolean>
  /** Reads the explicit form-owner ID propagated to each radio, when supplied. */
  form: Accessor<string | undefined>
  /** Reads the common size used by this group's options. */
  size: Accessor<ControlSize | undefined>
}>()

/** Named native fieldset with shared radio value, submission and reset ownership. */
export interface RadioGroupProps extends Omit<
  JSX.FieldsetHTMLAttributes<HTMLFieldSetElement>,
  'onChange'
> {
  label: JSX.Element

  value?: string
  defaultValue?: string
  required?: boolean
  /** Reports the proposed selected option value. */
  onValueChange?: (value: string) => void

  orientation?: 'horizontal' | 'vertical'
  size?: ControlSize | undefined
}

/**
 * Owns a group of Radio children with native keyboard selection, form submission and reset
 * behavior.
 */
export function RadioGroup(props: RadioGroupProps): JSX.Element {
  const rest = omit(
    props,
    'label',
    'value',
    'defaultValue',
    'required',
    'onValueChange',
    'orientation',
    'size',
    'class',
    'children',
    'ref',
  )

  const field = fieldAttributes(props, () => props.label)
  const id = createUniqueId()
  const name = () => props.name || id
  let group!: HTMLFieldSetElement
  const [value, change] = bindRadioSelection(
    () => group,
    name,
    () => props.value,
    () => props.defaultValue ?? '',
    (next) => props.onValueChange?.(next),
  )

  return (
    <RadioContext
      value={{
        name,
        value,
        change,

        /** Reads required state from the control or inherited field owner. */
        required: () => props.required ?? field.required ?? false,

        /** Reads the native form identity explicitly associated with the radio group. */
        form: () => props.form || undefined,
        size: () => props.size,
      }}
    >
      <fieldset
        {...field}
        {...rest}
        ref={[
          (node) => {
            group = node
          },
          props.ref,
        ]}
        class={[styles.root, props.class]}
        data-orientation={props.orientation ?? 'vertical'}
      >
        <legend class={styles.legend}>{props.label}</legend>
        {props.children}
      </fieldset>
    </RadioContext>
  )
}

/** Native radio attributes with a stable option value and optional inline label. */
export interface RadioProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'checked' | 'name' | 'size'
> {
  label?: JSX.Element
  value: string
}

/**
 * Renders an option using its RadioGroup's value, name and form owner.
 *
 * Callers provide an inline label or another native accessible naming association.
 */
export function Radio(props: RadioProps): JSX.Element {
  const group = useContext(RadioContext)

  const rest = omit(props, 'class', 'onChange', 'value', 'label')

  return (
    <ChoiceRow label={props.label} size={group.size()}>
      <input
        {...rest}
        type="radio"
        data-size={group.size() ?? 'default'}
        name={group.name()}
        form={group.form()}
        required={group.required()}
        value={props.value}
        checked={group.value() === props.value}
        class={[styles.option, props.class]}
        onChange={(event) => {
          if (event.currentTarget.checked) {
            group.change(props.value)
          }
          callHandler(props.onChange, event)
        }}
      />
    </ChoiceRow>
  )
}
