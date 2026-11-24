import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { fieldAttributes } from '../../internal/field'
import { RangeInput, type RangeAttributes } from '../../internal/range/control'
import { createValue } from '../../internal/state'

export interface SliderProps extends RangeAttributes {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
}

export function Slider(props: SliderProps): JSX.Element {
  const rest = omit(props, 'value', 'defaultValue', 'onValueChange')

  const baseline = () => props.defaultValue ?? ((props.min ?? 0) + (props.max ?? 100)) / 2
  const [value, change] = createValue(
    () => props.value,
    baseline,
    (next) => props.onValueChange?.(next),
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
