import { createContext, createUniqueId, omit, useContext, type Accessor } from 'solid-js'
import type { JSX } from '@solidjs/web'
import type { ControlSize } from '../../internal/control/size'
import { callHandler } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { bindRadioSelection } from '../../internal/choice/radio'
import { ChoiceRow } from '../../internal/choice/row'
import styles from './styles.module.css'

const RadioContext = createContext<{
  name: Accessor<string>
  value: Accessor<string>
  change: (value: string) => void
  required: Accessor<boolean>
  form: Accessor<string | undefined>
  size: Accessor<ControlSize | undefined>
}>()

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
  size?: ControlSize | undefined
}

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

        required: () => props.required ?? field.required ?? false,

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

export interface RadioProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'checked' | 'name' | 'size'
> {
  label?: JSX.Element
  value: string
}

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
