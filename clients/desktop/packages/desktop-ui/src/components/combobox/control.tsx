/** @fileoverview Searchable single and multiple fields retain committed option records across queries. */

import { mergeProps, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import type { ChipLabels } from '../../internal/selection/chips'
import { SelectionField } from '../../internal/selection/field'
import type { ChoiceFieldProps, ChoiceSearchProps } from '../../internal/selection/field'
import type { SelectionOption } from '../../internal/selection/types'
import { createValue } from '../../internal/state'

/** Stable selectable record retaining its display information across search queries. */
export type ComboboxOption = SelectionOption

/** Searchable field props for one committed option or an empty selection. */
interface SingleComboboxProps extends ChoiceFieldProps, ChoiceSearchProps {
  multiple?: false
  value?: ComboboxOption | null
  defaultValue?: ComboboxOption | null
  /** Reports the proposed committed option, or null when selection is cleared. */
  onValueChange?: (value: ComboboxOption | null) => void
}

/** Searchable field props for an ordered option selection with removable chips. */
interface MultipleComboboxProps extends ChoiceFieldProps, ChoiceSearchProps, ChipLabels {
  multiple: true
  value?: readonly ComboboxOption[]
  defaultValue?: readonly ComboboxOption[]
  /** Reports the proposed complete ordered selection. */
  onValueChange?: (value: readonly ComboboxOption[]) => void
}

/** Single or multiple searchable selection props with matching value and callback shapes. */
export type ComboboxProps = SingleComboboxProps | MultipleComboboxProps

const searchProps = [
  'query',
  'onQueryChange',
  'filter',
  'searchLabel',
  'searchPlaceholder',
  'loading',
  'loadingMessage',
] as const

/** Connects single-value ownership and form reset to the shared searchable selection field. */
function SingleCombobox(props: SingleComboboxProps): JSX.Element {
  const [local, search, rest] = splitProps(
    props,
    ['multiple', 'value', 'defaultValue', 'onValueChange'],
    searchProps,
  )
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? null,
    (next) => local.onValueChange?.(next),
  )

  return (
    <SelectionField
      {...rest}
      search={search}
      selected={value() ? [value()!] : []}
      defaults={local.defaultValue ? [local.defaultValue.value] : []}
      onChoose={change}
      onReset={() => change(local.defaultValue ?? null)}
    />
  )
}

/** Connects ordered selection, chip removal and form reset to the shared searchable field. */
function MultipleCombobox(props: MultipleComboboxProps): JSX.Element {
  const [local, search, labels, rest] = splitProps(
    props,
    ['multiple', 'value', 'defaultValue', 'onValueChange'],
    searchProps,
    ['removeLabel', 'scrollPreviousLabel', 'scrollNextLabel'],
  )
  const [values, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? [],
    (next) => local.onValueChange?.(next),
  )
  /** Requests removal of the selected option identified by its stable value key. */
  const remove = (key: string) => change(values().filter((option) => option.value !== key))

  return (
    <SelectionField
      {...rest}
      search={search}
      selected={values()}
      chips={mergeProps(labels, { remove })}
      defaults={local.defaultValue?.map((option) => option.value) ?? []}
      onChoose={(option) => {
        if (values().some((item) => item.value === option.value)) {
          remove(option.value)
        } else {
          change([...values(), option])
        }
      }}
      onReset={() => change(local.defaultValue ?? [])}
    />
  )
}

/** Renders committed single or multiple selections with a temporary search query in the popup. */
export function Combobox(props: ComboboxProps): JSX.Element {
  return <>{props.multiple ? <MultipleCombobox {...props} /> : <SingleCombobox {...props} />}</>
}
