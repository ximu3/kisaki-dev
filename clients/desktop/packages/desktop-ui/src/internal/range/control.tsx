import { createMemo, createEffect, flush, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../dom'
import { onFormReset } from '../state'
import { nativeValidityChanged } from '../form'
import styles from './styles.module.css'

/** Native numeric bounds, step and DOM attributes for a horizontal range control. */
export interface RangeAttributes extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'min' | 'max' | 'step'
> {
  min?: number
  max?: number
  step?: number | 'any'
}

/** Owned numeric range value with native-edit notification and an optional model-reset callback. */
interface RangeInputProps extends RangeAttributes {
  value: number
  defaultValue?: number
  /** Reports the numeric value produced by native range editing. */
  onValueChange: (value: number) => void
  /** Restores the owning control's reset value before the native element resynchronizes. */
  resetValue?: () => void
}

/**
 * Renders a native range with synchronized value, reset baseline and visual fill.
 *
 * After editing it resynchronizes even when a controlled owner retains the previous value.
 */
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

  // A native callback can read or submit a range before Solid processes its pending update.
  function syncOwner() {
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
