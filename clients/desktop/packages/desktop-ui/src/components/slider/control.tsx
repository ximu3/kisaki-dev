/** @fileoverview Native range slider with numeric value and reset ownership. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { fieldAttributes } from '../../internal/field'
import { RangeInput } from '../../internal/range/control'
import type { RangeAttributes } from '../../internal/range/control'
import { createValue } from '../../internal/state'

/**
 * Numeric slider value ownership with native min, max and step constraints.
 *
 * An omitted default starts from the range midpoint.
 */
export interface SliderProps extends RangeAttributes {
  value?: number
  defaultValue?: number
  /** Reports the native range control's proposed numeric value. */
  onValueChange?: (value: number) => void
}

/**
 * Binds a native range control to numeric value ownership and form reset.
 *
 * Keyboard behavior remains native; callers use aria-valuetext when units need explanation.
 */
export function Slider(props: SliderProps): JSX.Element {
  const [local, rest] = splitProps(props, ['value', 'defaultValue', 'onValueChange'])

  /**
   * Returns the explicit default value or configured range midpoint for initialization and reset.
   */
  const baseline = () => local.defaultValue ?? ((props.min ?? 0) + (props.max ?? 100)) / 2
  const [value, change] = createValue(
    () => local.value,
    baseline,
    (next) => local.onValueChange?.(next),
  )

  return (
    <RangeInput
      {...fieldAttributes(props)}
      {...rest}
      value={value()}
      defaultValue={baseline()}
      resetValue={() => change(baseline())}
      onValueChange={change}
    />
  )
}
