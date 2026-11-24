import { createMemo, createEffect, flush, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../dom'
import { onFormReset } from '../state'
import { nativeValidityChanged } from '../form'
import styles from './styles.module.css'

export interface RangeAttributes extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'min' | 'max' | 'step'
> {
  min?: number
  max?: number
  step?: number | 'any'
}

interface RangeInputProps extends RangeAttributes {
  value: number
  defaultValue?: number
  onValueChange: (value: number) => void
  resetValue?: () => void
}

export function RangeInput(props: RangeInputProps): JSX.Element {
  const rest = omit(
    props,
    'value',
    'defaultValue',
    'resetValue',
    'onValueChange',
    'class',
    'ref',
    'onInput',
  )

  let input!: HTMLInputElement

  const state = createMemo(() => ({
    value: props.value,
    initial: props.defaultValue ?? props.value,
    min: props.min ?? 0,
    max: props.max ?? 100,
    step: props.step,
    // Reapply the fill after a supplied style replaces the input's inline properties.
    style: props.style,
  }))
  const sync = ({ value, initial, min, max }: ReturnType<typeof state>) => {
    input.defaultValue = String(initial)
    input.value = String(value)
    const fraction = max > min ? (input.valueAsNumber - min) / (max - min) : 0
    input.style.setProperty('--range-fraction', String(fraction))
    nativeValidityChanged(input.form)
  }
  createEffect(state, sync)

  function syncOwner() {
    // A native callback can read or submit a range before Solid processes its pending update.
    flush()
    sync(state())
  }

  const flushReset = onFormReset(
    () => input,
    () => {
      props.resetValue?.()
      syncOwner()
    },
  )

  return (
    <input
      {...rest}
      type="range"
      class={[styles.range, props.class]}
      ref={[
        (node) => {
          input = node
        },
        props.ref,
      ]}
      onInput={(event) => {
        const next = event.currentTarget.valueAsNumber
        flushReset()
        props.onValueChange(next)
        syncOwner()
        callHandler(props.onInput, event)
      }}
    />
  )
}
