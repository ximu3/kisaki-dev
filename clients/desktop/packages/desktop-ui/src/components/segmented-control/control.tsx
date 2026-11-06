/** @fileoverview Segmented selection with native radio group semantics. */

import { createUniqueId, For, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, classes } from '../../internal/dom'
import { createValue, onFormReset } from '../../internal/state'
import styles from './styles.module.css'

/** Labels are caller-provided content; values are stable native form values. */
export interface SegmentOption {
  readonly value: string
  readonly label: JSX.Element
  readonly disabled?: boolean
}

/** label names the group. All options share the same native form owner and keyboard selection. */
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

/** Select a single view or value with native arrow/Space behavior and form reset. */
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

  const id = createUniqueId()
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
      {...rest}
      ref={(node) => {
        group = node
        assignRef(local.ref, node)
      }}
      aria-label={local.label}
      class={classes(styles.root, local.class)}
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
              required={local.required}
              onChange={(event) => {
                if (event.currentTarget.checked) {
                  change(option.value)
                }
              }}
            />
            <span>{option.label}</span>
          </label>
        )}
      </For>
    </fieldset>
  )
}
