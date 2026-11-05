/** @fileoverview Single-line text editing with native selection, validation and submission. */

import { createEffect, splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { bindNativeValue, inputClass } from './form/native'

/** Text remains a string, including the raw value of numeric and date inputs. */
export interface InputProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'checked'
> {
  type?:
    | 'text'
    | 'search'
    | 'password'
    | 'email'
    | 'url'
    | 'tel'
    | 'number'
    | 'date'
    | 'datetime-local'
    | 'time'
    | 'month'
    | 'week'
  value?: string | undefined
  defaultValue?: string
  onValueChange?: (value: string) => void
}

/** Native edits and completed form resets report the current value. */
export function Input(props: InputProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'class',
    'ref',
    'value',
    'defaultValue',
    'onValueChange',
  ])
  let input!: HTMLInputElement
  createEffect(() => {
    input.defaultValue = local.defaultValue ?? ''
  })
  bindNativeValue(
    () => input,
    () => local.value,
    () => input.value,
    (v) => {
      input.value = v
    },
    (v) => local.onValueChange?.(v),
    'input',
    true,
  )

  return (
    <input
      {...rest}
      ref={(el) => {
        input = el
        if (typeof local.ref === 'function') {
          local.ref(el)
        }
      }}
      class={twMerge(inputClass, 'h-7', local.class)}
    />
  )
}
