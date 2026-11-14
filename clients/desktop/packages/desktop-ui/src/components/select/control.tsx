/** @fileoverview Single and multiple desktop selectors commit stable option keys. */

import { createMemo, mergeProps, splitProps } from 'solid-js'
import type { Accessor, JSX } from 'solid-js'
import type { ChipLabels } from '../../internal/selection/chips'
import { SelectionField } from '../../internal/selection/field'
import type { ChoiceFieldProps } from '../../internal/selection/field'
import type { SelectionOption } from '../../internal/selection/types'
import { createValue } from '../../internal/state'

/**
 * Single-selection field props storing a stable option key.
 *
 * An empty string represents no choice, independently of which rows are mounted.
 */
export interface SelectProps extends ChoiceFieldProps {
  value?: string
  defaultValue?: string
  /** Reports the proposed selected option key. */
  onValueChange?: (value: string) => void
}

/**
 * Multiple-selection field props storing ordered stable option keys.
 *
 * Activation toggles one value without requiring a platform modifier key.
 */
export interface MultiSelectProps extends ChoiceFieldProps, ChipLabels {
  value?: readonly string[]
  defaultValue?: readonly string[]
  /** Reports the proposed complete ordered list of selected keys. */
  onValueChange?: (value: readonly string[]) => void
}

/** Creates a reactive option lookup that preserves missing keys as disabled display records. */
function resolveKeys(options: Accessor<readonly SelectionOption[]>) {
  /** Reactive option catalog used to resolve selected keys without losing their records. */
  const catalog = createMemo(() => new Map(options().map((option) => [option.value, option])))
  return (key: string): SelectionOption =>
    catalog().get(key) ?? { value: key, label: key, disabled: true }
}

/**
 * Renders a single-choice field that closes after selection.
 *
 * The trigger retains keyboard focus and receives focus when native form validation requests
 * attention.
 */
export function Select(props: SelectProps): JSX.Element {
  const [local, rest] = splitProps(props, ['value', 'defaultValue', 'onValueChange'])
  /** Current option-key resolver bound to the selection control's option source. */
  const resolve = resolveKeys(() => rest.options)
  /** Live single-selection key and change requests delegated to its value owner. */
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? '',
    (next) => local.onValueChange?.(next),
  )

  return (
    <SelectionField
      {...rest}
      selected={value() ? [resolve(value())] : []}
      defaults={local.defaultValue ? [local.defaultValue] : []}
      onChoose={(option) => change(option.value)}
      onReset={() => change(local.defaultValue ?? '')}
    />
  )
}

/**
 * Renders toggled list choices and removable field chips while preserving selected submission
 * order.
 */
export function MultiSelect(props: MultiSelectProps): JSX.Element {
  const [local, labels, rest] = splitProps(
    props,
    ['value', 'defaultValue', 'onValueChange'],
    ['removeLabel', 'scrollPreviousLabel', 'scrollNextLabel'],
  )
  /** Live multiple-selection keys and change requests delegated to their value owner. */
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? [],
    (next) => local.onValueChange?.(next),
  )
  /** Current option-key resolver bound to the selection control's option source. */
  const resolve = resolveKeys(() => rest.options)

  return (
    <SelectionField
      {...rest}
      chips={mergeProps(labels, {
        /** Requests removal of one selected key while preserving the other selected values. */
        remove: (key: string) => change(value().filter((item) => item !== key)),
      })}
      selected={value().map(resolve)}
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
