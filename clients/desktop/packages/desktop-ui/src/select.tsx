/** @fileoverview Single and multiple native selects with distinct submitted option values. */

import {
  createEffect,
  createSignal,
  For,
  onMount,
  createRenderEffect,
  splitProps,
  type JSX,
} from 'solid-js'
import { afterEvent } from './dom-events'
import { twMerge } from 'tailwind-merge'
import { inputClass, onFormReset } from './form/native'

export interface SelectOption {
  value: string
  label: string
  /** The single-select picker shows this explanation. Its closed button keeps the short label. */
  description?: string
  disabled?: boolean
}

interface SelectBase extends Omit<
  JSX.SelectHTMLAttributes<HTMLSelectElement>,
  'multiple' | 'value' | 'children'
> {
  options: readonly SelectOption[]
}

/** The browser supplies the first eligible option if both initial values are omitted. */
export interface SelectProps extends SelectBase {
  multiple?: false
  value?: string | undefined
  defaultValue?: string
  onValueChange?: (value: string) => void
}

/** Multiple values submit as repeated entries under the same form name. */
export interface MultiSelectProps extends SelectBase {
  multiple: true
  value?: readonly string[] | undefined
  defaultValue?: readonly string[]
  onValueChange?: (values: string[]) => void
}

/** Select only available, enabled options. An unavailable controlled value has no submitted entry. */
export function Select(props: SelectProps | MultiSelectProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'class',
    'ref',
    'options',
    'multiple',
    'value',
    'defaultValue',
    'onValueChange',
  ])
  const [draft, setDraft] = createSignal<string | readonly string[] | undefined>(local.defaultValue)
  let select!: HTMLSelectElement

  /** Apply the selected values to the current result set, excluding disabled options. */
  function sync(): void {
    // Options may be replaced independently of the selected business value.
    const options = local.options
    const desired = local.value ?? draft()
    if (desired === undefined) {
      if (!local.multiple) {
        select.selectedIndex = options.findIndex((option) => !option.disabled)
      }
      return
    }
    if (typeof desired === 'string') {
      select.selectedIndex = options.findIndex(
        (option) => !option.disabled && option.value === desired,
      )
      return
    }
    const values = new Set(desired)
    for (const [i, option] of options.entries()) {
      select.options[i]!.selected = !option.disabled && values.has(option.value)
    }
  }

  const settle = afterEvent(sync)

  /** Report the browser's actual selection after a change or accepted reset. */
  function changed(): void {
    if (local.value !== undefined) {
      settle()
    }
    if (props.multiple) {
      const values = Array.from(select.selectedOptions)
        .filter((option) => !option.disabled)
        .map((option) => option.value)
      if (local.value === undefined) {
        setDraft(values)
      }
      props.onValueChange?.(values)
    } else {
      const value = select.selectedOptions[0]?.disabled ? '' : select.value
      if (local.value === undefined) {
        setDraft(value)
      }
      props.onValueChange?.(value)
    }
  }

  createEffect(sync)
  onMount(() => onFormReset(select, changed))
  return (
    <select
      {...rest}
      ref={(el) => {
        select = el
        if (typeof local.ref === 'function') {
          local.ref(el)
        }
      }}
      multiple={local.multiple}
      on:change={changed}
      class={twMerge(inputClass, 'ks-select', !local.multiple && 'h-7', local.class)}
    >
      <For each={local.options}>
        {(option) => (
          <option
            value={option.value}
            aria-label={option.description ? option.label : undefined}
            aria-description={option.description}
            disabled={option.disabled}
            ref={(el) =>
              createRenderEffect(() => {
                el.defaultSelected =
                  typeof local.defaultValue === 'string'
                    ? local.defaultValue === option.value
                    : (local.defaultValue?.includes(option.value) ?? false)
              })
            }
          >
            {option.label}
          </option>
        )}
      </For>
    </select>
  )
}
