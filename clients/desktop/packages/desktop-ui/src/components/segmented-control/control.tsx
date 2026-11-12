/** @fileoverview Segmented selection with native radio group semantics. */

import { createUniqueId, For, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, classes } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { createValue, onFormReset } from '../../internal/state'
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
  const [local, rest] = splitProps(props, [
    'label',
    'options',
    'value',
    'defaultValue',
    'required',
    'onValueChange',
    'class',
    'ref',
  ])

  const field = fieldAttributes(props, () => local.label)
  const id = createUniqueId()
  /** Returns the explicit default or first enabled option for initialization and form reset. */
  const baseline = () =>
    local.defaultValue ?? local.options.find((option) => !option.disabled)?.value ?? ''
  const [value, change] = createValue(
    () => local.value,
    baseline,
    (next) => local.onValueChange?.(next),
  )
  let group!: HTMLFieldSetElement
  onFormReset(
    () => group,
    () => {
      change(baseline())
      for (const input of group.querySelectorAll<HTMLInputElement>('input')) {
        input.checked = input.value === value()
      }
    },
  )

  return (
    <fieldset
      {...field}
      {...rest}
      ref={(node) => {
        group = node
        assignRef(local.ref, node)
      }}
      aria-label={local.label}
      class={classes(segmented.group, local.class)}
    >
      <For each={local.options}>
        {(option) => (
          <label class={styles.segment}>
            <input
              type="radio"
              name={props.name ?? id}
              form={props.form}
              value={option.value}
              checked={value() === option.value}
              disabled={option.disabled}
              required={local.required ?? field.required}
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
