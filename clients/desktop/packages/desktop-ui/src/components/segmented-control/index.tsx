import { createUniqueId, For, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { fieldAttributes } from '../../internal/field'
import { bindRadioSelection } from '../../internal/choice/radio'
import styles from './styles.module.css'
import segmented from '../../internal/segmented.module.css'

export interface SegmentOption {
  readonly value: string
  readonly label: JSX.Element
  readonly disabled?: boolean
}

export interface SegmentedControlProps extends Omit<
  JSX.FieldsetHTMLAttributes<HTMLFieldSetElement>,
  'onChange'
> {
  label: string
  options: readonly SegmentOption[]

  value?: string
  defaultValue?: string
  required?: boolean
  onValueChange?: (value: string) => void
}

export function SegmentedControl(props: SegmentedControlProps): JSX.Element {
  const rest = omit(
    props,
    'label',
    'options',
    'value',
    'defaultValue',
    'required',
    'onValueChange',
    'class',
    'ref',
  )

  const field = fieldAttributes(props, () => props.label)
  const id = createUniqueId()
  const name = () => props.name || id
  let group!: HTMLFieldSetElement
  const baseline = () =>
    props.defaultValue ?? props.options.find((option) => !option.disabled)?.value ?? ''
  const [value, change] = bindRadioSelection(
    () => group,
    name,
    () => props.value,
    baseline,
    (next) => props.onValueChange?.(next),
  )

  return (
    <fieldset
      {...field}
      {...rest}
      ref={[
        (node) => {
          group = node
        },
        props.ref,
      ]}
      aria-label={props.label}
      class={[segmented.group, props.class]}
    >
      <For each={props.options}>
        {(option) => (
          <label class={styles.segment}>
            <input
              type="radio"
              name={name()}
              form={props.form}
              value={option.value}
              checked={value() === option.value}
              disabled={option.disabled}
              required={props.required ?? field.required}
              onChange={(event) => {
                if (event.currentTarget.checked) {
                  change(option.value)
                }
              }}
            />
            <span class={segmented.item}>{option.label}</span>
          </label>
        )}
      </For>
    </fieldset>
  )
}
