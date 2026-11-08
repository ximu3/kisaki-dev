/** @fileoverview Searchable single and multiple fields retain committed option records across queries. */

import { mergeProps, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import type { ChipLabels } from '../../internal/selection/chips'
import { SelectionField } from '../../internal/selection/field'
import type { ChoiceFieldProps, ChoiceSearchProps } from '../../internal/selection/field'
import type { SelectionOption } from '../../internal/selection/types'
import { createValue } from '../../internal/state'

export type ComboboxOption = SelectionOption

interface SingleComboboxProps extends ChoiceFieldProps, ChoiceSearchProps {
  multiple?: false
  value?: ComboboxOption | null
  defaultValue?: ComboboxOption | null
  onValueChange?: (value: ComboboxOption | null) => void
}

interface MultipleComboboxProps extends ChoiceFieldProps, ChoiceSearchProps, ChipLabels {
  multiple: true
  value?: readonly ComboboxOption[]
  defaultValue?: readonly ComboboxOption[]
  onValueChange?: (value: readonly ComboboxOption[]) => void
}

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

/** The button displays the committed selection. Its popup accepts a temporary search query. */
export function Combobox(props: ComboboxProps): JSX.Element {
  return <>{props.multiple ? <MultipleCombobox {...props} /> : <SingleCombobox {...props} />}</>
}
