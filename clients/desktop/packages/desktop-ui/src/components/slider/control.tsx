/** @fileoverview Native range slider with numeric value and reset ownership. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { fieldAttributes } from '../../internal/field'
import { RangeInput } from '../../internal/range/control'
import type { RangeAttributes } from '../../internal/range/control'
import { createValue } from '../../internal/state'

/** min/max/step use native range rules; defaultValue defaults to the native midpoint. */
export interface SliderProps extends RangeAttributes {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
}

/** Arrow, Home and End behavior stays native; use aria-valuetext when units need explanation. */
export function Slider(props: SliderProps): JSX.Element {
  const [local, rest] = splitProps(props, ['value', 'defaultValue', 'onValueChange'])

  const baseline = () => local.defaultValue ?? ((props.min ?? 0) + (props.max ?? 100)) / 2
  const [value, change] = createValue(
    () => local.value,
    baseline,
    (next) => local.onValueChange?.(next),
  )

  return (
    <RangeInput
      {...fieldAttributes()}
      {...rest}
      value={value()}
      defaultValue={baseline()}
      resetValue={() => change(baseline())}
      onValueChange={change}
    />
  )
}
