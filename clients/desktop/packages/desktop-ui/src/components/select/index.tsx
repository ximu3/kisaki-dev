import { createMemo, merge, omit, type Accessor } from 'solid-js'
import type { JSX } from '@solidjs/web'
import type { ChipLabels } from '../../internal/chips/control'
import { SelectionField, type ChoiceFieldProps } from '../selection/field'
import type { SelectionOption } from '../selection/types'
import { createValue } from '../../internal/state'

export type { ControlSize } from '../../internal/control/size'
export type {
  SelectionOption as SelectOption,
  SelectionListRenderProps as SelectListRenderProps,
} from '../selection/types'

export interface SelectProps<K extends string = string> extends ChoiceFieldProps<
  SelectionOption<K>
> {
  value?: K | ''
  defaultValue?: K | ''
  onValueChange?: (value: K | '') => void
}

export interface MultiSelectProps<K extends string = string>
  extends ChoiceFieldProps<SelectionOption<K>>, ChipLabels {
  value?: readonly K[]
  defaultValue?: readonly K[]
  onValueChange?: (value: readonly K[]) => void
}

function resolveKeys<K extends string>(options: Accessor<readonly SelectionOption<K>[]>) {
  const catalog = createMemo(() => new Map(options().map((option) => [option.value, option])))
  return (key: K): SelectionOption<K> =>
    catalog().get(key) ?? { value: key, label: key, disabled: true }
}

export function Select<K extends string = string>(props: SelectProps<K>): JSX.Element {
  const rest = omit(props, 'value', 'defaultValue', 'onValueChange')
  const resolve = resolveKeys(() => rest.options)
  const [value, change] = createValue(
    () => props.value,
    () => props.defaultValue ?? '',
    (next) => props.onValueChange?.(next),
  )

  const selected = () => {
    const key = value()
    return key ? [resolve(key)] : []
  }

  return (
    <SelectionField
      {...rest}
      selected={selected()}
      defaults={props.defaultValue ? [props.defaultValue] : []}
      onChoose={(option) => change(option.value)}
      onReset={() => change(props.defaultValue ?? '')}
    />
  )
}

export function MultiSelect<K extends string = string>(props: MultiSelectProps<K>): JSX.Element {
  const rest = omit(
    props,
    'value',
    'defaultValue',
    'onValueChange',
    'removeLabel',
    'scrollPreviousLabel',
    'scrollNextLabel',
  )
  const [value, change] = createValue(
    () => props.value,
    () => props.defaultValue ?? [],
    (next) => props.onValueChange?.(next),
  )
  const resolve = resolveKeys(() => rest.options)

  return (
    <SelectionField
      {...rest}
      chips={merge(props, {
        remove: (key: string) => change(value().filter((item) => item !== key)),
      })}
      selected={value().map(resolve)}
      defaults={props.defaultValue ?? []}
      onChoose={(option) =>
        change(
          value().includes(option.value)
            ? value().filter((item) => item !== option.value)
            : [...value(), option.value],
        )
      }
      onReset={() => change(props.defaultValue ?? [])}
    />
  )
}
