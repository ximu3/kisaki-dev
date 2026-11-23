/** @fileoverview Segmented selection with native radio group semantics. */

import { createUniqueId, For, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { fieldAttributes } from '../../internal/field'
import { bindRadioSelection } from '../../internal/choice/radio'
import styles from './styles.module.css'
import segmented from '../../internal/segmented.module.css'

/** Stable native form value with caller-provided label content and optional disabled state. */
export interface SegmentOption {
  readonly value: string
  readonly label: JSX.Element
  readonly disabled?: boolean
}

/**
 * Named segmented-choice field with controlled or local selection.
 *
 * Options share one native form owner and keyboard selection model.
 */
export interface SegmentedControlProps extends Omit<
  JSX.FieldsetHTMLAttributes<HTMLFieldSetElement>,
  'onChange'
> {
  label: string
  options: readonly SegmentOption[]

  value?: string
  defaultValue?: string
  required?: boolean
  /** Reports the proposed selected segment value. */
  onValueChange?: (value: string) => void
}

/** Renders a single-value segmented choice using native radio keyboard and reset behavior. */
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
  /** Returns the explicit default or first enabled option for initialization and form reset. */
  const baseline = () =>
    props.defaultValue ?? props.options.find((option) => !option.disabled)?.value ?? ''
  /** Live segment selection and change requests using the group's initial baseline. */
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
