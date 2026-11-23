/** @fileoverview Searchable single and multiple fields retain committed option records across queries. */

import { merge, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import type { ChipLabels } from '../../internal/chips/control'
import { SelectionField } from '../selection/field'
import type { ChoiceFieldProps, ChoiceSearchProps } from '../selection/field'
import type { SelectionOption } from '../selection/types'
import { createValue } from '../../internal/state'

/** Stable selectable record retaining its display information across search queries. */
export type ComboboxOption = SelectionOption

/** Searchable field props for one committed option or an empty selection. */
interface SingleComboboxProps<O extends ComboboxOption>
  extends ChoiceFieldProps<O>, ChoiceSearchProps<O> {
  multiple?: false
  value?: O | null
  defaultValue?: O | null
  /** Reports the proposed committed option, or null when selection is cleared. */
  onValueChange?: (value: O | null) => void
}

/** Searchable field props for an ordered option selection with removable chips. */
interface MultipleComboboxProps<O extends ComboboxOption>
  extends ChoiceFieldProps<O>, ChoiceSearchProps<O>, ChipLabels {
  multiple: true
  value?: readonly O[]
  defaultValue?: readonly O[]
  /** Reports the proposed complete ordered selection. */
  onValueChange?: (value: readonly O[]) => void
}

/** Single or multiple searchable selection props with matching value and callback shapes. */
export type ComboboxProps<O extends ComboboxOption = ComboboxOption> =
  | SingleComboboxProps<O>
  | MultipleComboboxProps<O>

/** Search-owned combobox properties kept separate from the underlying selection control. */
const searchProps = [
  'query',
  'onQueryChange',
  'filter',
  'searchLabel',
  'clearSearchLabel',
  'searchPlaceholder',
  'loading',
  'loadingMessage',
] as const

/** Connects single-value ownership and form reset to the shared searchable selection field. */
function SingleCombobox<O extends ComboboxOption>(props: SingleComboboxProps<O>): JSX.Element {
  const rest = omit(props, 'multiple', 'value', 'defaultValue', 'onValueChange', ...searchProps)
  const [value, change] = createValue(
    () => props.value,
    () => props.defaultValue ?? null,
    (next) => props.onValueChange?.(next),
  )

  return (
    <SelectionField
      {...rest}
      search={props}
      selected={value() ? [value()!] : []}
      defaults={props.defaultValue ? [props.defaultValue.value] : []}
      onChoose={change}
      onReset={() => change(props.defaultValue ?? null)}
    />
  )
}

/** Connects ordered selection, chip removal and form reset to the shared searchable field. */
function MultipleCombobox<O extends ComboboxOption>(props: MultipleComboboxProps<O>): JSX.Element {
  const rest = omit(
    props,
    'multiple',
    'value',
    'defaultValue',
    'onValueChange',
    ...searchProps,
    'removeLabel',
    'scrollPreviousLabel',
    'scrollNextLabel',
  )
  const [values, change] = createValue(
    () => props.value,
    () => props.defaultValue ?? [],
    (next) => props.onValueChange?.(next),
  )
  const remove = (key: string) => change(values().filter((option) => option.value !== key))

  return (
    <SelectionField
      {...rest}
      search={props}
      selected={values()}
      chips={merge(props, { remove })}
      defaults={props.defaultValue?.map((option) => option.value) ?? []}
      onChoose={(option) => {
        if (values().some((item) => item.value === option.value)) {
          remove(option.value)
        } else {
          change([...values(), option])
        }
      }}
      onReset={() => change(props.defaultValue ?? [])}
    />
  )
}

/** Renders committed single or multiple selections with a temporary search query in the popup. */
export function Combobox<O extends ComboboxOption = ComboboxOption>(
  props: ComboboxProps<O>,
): JSX.Element {
  return <>{props.multiple ? <MultipleCombobox {...props} /> : <SingleCombobox {...props} />}</>
}
