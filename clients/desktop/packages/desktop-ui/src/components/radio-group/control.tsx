/** @fileoverview Native radio groups share one value and reset boundary. */

import { createContext, createUniqueId, splitProps, useContext } from 'solid-js'
import type { Accessor, JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { createValue, onFormReset } from '../../internal/state'
import { ChoiceRow } from '../../internal/choice/row'
import styles from './styles.module.css'

const RadioContext = createContext<{
  name: Accessor<string>
  value: Accessor<string>
  change: (value: string) => void
  required: Accessor<boolean>
  form: Accessor<string | undefined>
}>()

/** A native fieldset and legend; options with the same group share submission and reset. */
export interface RadioGroupProps extends Omit<
  JSX.FieldsetHTMLAttributes<HTMLFieldSetElement>,
  'onChange'
> {
  label: JSX.Element

  value?: string
  defaultValue?: string
  required?: boolean
  onValueChange?: (value: string) => void

  orientation?: 'horizontal' | 'vertical'
}

/** Supply Radio children. Native arrow keys select and focus enabled options. */
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

  const field = fieldAttributes()
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

/** value identifies this option; disabled options keep native group behavior. */
export interface RadioProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'checked' | 'name'
> {
  label?: JSX.Element
  value: string
}

/** A native radio; label it with an enclosing label or an explicit id/for pair. */
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
