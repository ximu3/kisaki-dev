import { createMemo, merge, omit } from 'solid-js'
import type { Accessor } from 'solid-js'
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

/**
 * Single-selection field props storing a stable option key.
 *
 * An empty string represents no choice, independently of which rows are mounted.
 */
export interface SelectProps<K extends string = string> extends ChoiceFieldProps<
  SelectionOption<K>
> {
  value?: K | ''
  defaultValue?: K | ''
  /** Reports the proposed selected option key. */
  onValueChange?: (value: K | '') => void
}

/**
 * Multiple-selection field props storing ordered stable option keys.
 *
 * Activation toggles one value without requiring a platform modifier key.
 */
export interface MultiSelectProps<K extends string = string>
  extends ChoiceFieldProps<SelectionOption<K>>, ChipLabels {
  value?: readonly K[]
  defaultValue?: readonly K[]
  /** Reports the proposed complete ordered list of selected keys. */
  onValueChange?: (value: readonly K[]) => void
}

/** Creates a reactive option lookup that preserves missing keys as disabled display records. */
function resolveKeys<K extends string>(options: Accessor<readonly SelectionOption<K>[]>) {
  const catalog = createMemo(() => new Map(options().map((option) => [option.value, option])))
  return (key: K): SelectionOption<K> =>
    catalog().get(key) ?? { value: key, label: key, disabled: true }
}

/**
 * Renders a single-choice field that closes after selection.
 *
 * The trigger retains keyboard focus and receives focus when native form validation requests
 * attention.
 */
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

/**
 * Renders toggled list choices and removable field chips while preserving selected submission
 * order.
 */
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
