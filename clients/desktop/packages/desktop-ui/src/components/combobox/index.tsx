import { merge, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import type { ChipLabels } from '../../internal/chips/control'
import { SelectionField, type ChoiceFieldProps, type ChoiceSearchProps } from '../selection/field'
import type { SelectionOption } from '../selection/types'
import { createValue } from '../../internal/state'

export type { ControlSize } from '../../internal/control/size'

export type ComboboxOption = SelectionOption

interface SingleComboboxProps<O extends ComboboxOption>
  extends ChoiceFieldProps<O>, ChoiceSearchProps<O> {
  multiple?: false
  value?: O | null
  defaultValue?: O | null
  onValueChange?: (value: O | null) => void
}

interface MultipleComboboxProps<O extends ComboboxOption>
  extends ChoiceFieldProps<O>, ChoiceSearchProps<O>, ChipLabels {
  multiple: true
  value?: readonly O[]
  defaultValue?: readonly O[]
  onValueChange?: (value: readonly O[]) => void
}

export type ComboboxProps<O extends ComboboxOption = ComboboxOption> =
  | SingleComboboxProps<O>
  | MultipleComboboxProps<O>

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
  const remove = (key: string) =>
    change((selected) => selected.filter((option) => option.value !== key))

  return (
    <SelectionField
      {...rest}
      search={props}
      selected={values()}
      chips={merge(props, { remove })}
      defaults={props.defaultValue?.map((option) => option.value) ?? []}
      onChoose={(option) =>
        change((selected) =>
          selected.some((item) => item.value === option.value)
            ? selected.filter((item) => item.value !== option.value)
            : [...selected, option],
        )
      }
      onReset={() => change(props.defaultValue ?? [])}
    />
  )
}

export function Combobox<O extends ComboboxOption = ComboboxOption>(
  props: ComboboxProps<O>,
): JSX.Element {
  return <>{props.multiple ? <MultipleCombobox {...props} /> : <SingleCombobox {...props} />}</>
}
