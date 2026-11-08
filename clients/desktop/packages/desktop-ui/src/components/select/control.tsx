/** @fileoverview Single and multiple desktop selectors commit stable option keys. */

import { mergeProps, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import type { ChipLabels } from '../../internal/selection/chips'
import { SelectionField } from '../../internal/selection/field'
import type { ChoiceFieldProps } from '../../internal/selection/field'
import { createValue } from '../../internal/state'

/** An empty value represents no choice. Options retain identity independently of mounted rows. */
export interface SelectProps extends ChoiceFieldProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

/** User activation toggles one value; no platform modifier key is required. */
export interface MultiSelectProps extends ChoiceFieldProps, ChipLabels {
  value?: readonly string[]
  defaultValue?: readonly string[]
  onValueChange?: (value: readonly string[]) => void
}

/** A single choice closes the list. The trigger keeps keyboard focus and native form validation targets it. */
export function Select(props: SelectProps): JSX.Element {
  const [local, rest] = splitProps(props, ['value', 'defaultValue', 'onValueChange'])
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? '',
    (next) => local.onValueChange?.(next),
  )

  return (
    <SelectionField
      {...rest}
      selected={value() ? [value()] : []}
      defaults={local.defaultValue ? [local.defaultValue] : []}
      onChoose={(option) => change(option.value)}
      onReset={() => change(local.defaultValue ?? '')}
    />
  )
}

/** Toggle choices in the open list or remove them directly in the field. Submission preserves selected order. */
export function MultiSelect(props: MultiSelectProps): JSX.Element {
  const [local, labels, rest] = splitProps(
    props,
    ['value', 'defaultValue', 'onValueChange'],
    ['removeLabel', 'scrollPreviousLabel', 'scrollNextLabel'],
  )
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? [],
    (next) => local.onValueChange?.(next),
  )

  return (
    <SelectionField
      {...rest}
      chips={mergeProps(labels, {
        remove: (key: string) => change(value().filter((item) => item !== key)),
      })}
      selected={value()}
      defaults={local.defaultValue ?? []}
      onChoose={(option) =>
        change(
          value().includes(option.value)
            ? value().filter((item) => item !== option.value)
            : [...value(), option.value],
        )
      }
      onReset={() => change(local.defaultValue ?? [])}
    />
  )
}
