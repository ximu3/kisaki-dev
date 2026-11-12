/** @fileoverview Native radio groups share one value and reset boundary. */

import { createContext, createUniqueId, splitProps, useContext } from 'solid-js'
import type { Accessor, JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { createValue, onFormReset } from '../../internal/state'
import { ChoiceRow } from '../../internal/choice/row'
import styles from './styles.module.css'

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
}

/**
 * Owns a group of Radio children with native keyboard selection, form submission and reset
 * behavior.
 */
export function RadioGroup(props: RadioGroupProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'label',
    'value',
    'defaultValue',
    'required',
    'onValueChange',
    'orientation',
    'class',
    'children',
    'ref',
  ])

  const field = fieldAttributes(props, () => local.label)
  const name = createUniqueId()
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? '',
    (next) => local.onValueChange?.(next),
  )
  let group!: HTMLFieldSetElement
  onFormReset(
    () => group,
    () => {
      change(local.defaultValue ?? '')
      for (const input of group.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
        input.checked = input.value === value()
      }
    },
  )

  return (
    <RadioContext.Provider
      value={{
        name: () => props.name ?? name,
        value,
        change,
        required: () => local.required ?? field.required ?? false,
        form: () => props.form,
      }}
    >
      <fieldset
        {...field}
        {...rest}
        ref={(node) => {
          group = node
          assignRef(local.ref, node)
        }}
        class={classes(styles.root, local.class)}
        data-orientation={local.orientation ?? 'vertical'}
      >
        <legend class={styles.legend}>{local.label}</legend>
        {local.children}
      </fieldset>
    </RadioContext.Provider>
  )
}

/** Native radio attributes with a stable option value and optional inline label. */
export interface RadioProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'checked' | 'name'
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
  if (!group) {
    throw new Error('Radio requires RadioGroup.')
  }

  const [local, rest] = splitProps(props, ['class', 'onChange', 'value', 'label'])

  return (
    <ChoiceRow label={local.label}>
      <input
        {...rest}
        type="radio"
        name={group.name()}
        form={group.form()}
        required={group.required()}
        value={local.value}
        checked={group.value() === local.value}
        class={classes(styles.option, local.class)}
        onChange={(event) => {
          if (event.currentTarget.checked) {
            group.change(local.value)
          }
          callHandler(local.onChange, event)
        }}
      />
    </ChoiceRow>
  )
}
