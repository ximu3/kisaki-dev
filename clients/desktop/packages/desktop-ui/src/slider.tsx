/** @fileoverview Native range selection with browser clamping, stepping and form reset. */

import { createEffect, splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { bindNativeValue } from './form/native'

export interface SliderProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value'
> {
  value?: number | undefined
  defaultValue?: number
  onValueChange?: (value: number) => void
}

/** Report the numeric value after the browser applies the range and step. */
export function Slider(props: SliderProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'class',
    'ref',
    'value',
    'defaultValue',
    'onValueChange',
  ])
  let input!: HTMLInputElement
  createEffect(() => {
    input.defaultValue = String(local.defaultValue ?? '')
  })
  bindNativeValue(
    () => input,
    () => local.value,
    () => input.valueAsNumber,
    (v) => {
      input.valueAsNumber = v
    },
    (v) => local.onValueChange?.(v),
    'input',
  )

  return (
    <input
      {...rest}
      type="range"
      ref={(el) => {
        input = el
        if (typeof local.ref === 'function') {
          local.ref(el)
        }
      }}
      class={twMerge('ks-focus m-0 h-5 w-full accent-primary disabled:opacity-50', local.class)}
    />
  )
}
