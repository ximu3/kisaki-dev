/** @fileoverview A native range paints its normalized value up to the center of its thumb. */

import { createEffect, on, onMount, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../dom'
import { onFormReset } from '../state'
import styles from './styles.module.css'

/** Native numeric bounds, step and DOM attributes for a horizontal range. */
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

/** Synchronize after native editing or reset, including when a controlled owner keeps its value. */
export function RangeInput(props: RangeInputProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'value',
    'defaultValue',
    'resetValue',
    'onValueChange',
    'class',
    'ref',
    'onInput',
  ])
  let input!: HTMLInputElement

  const sync = () => {
    input.defaultValue = String(local.defaultValue ?? local.value)
    input.value = String(local.value)

    const min = props.min ?? 0
    const max = props.max ?? 100
    const fraction = max > min ? (input.valueAsNumber - min) / (max - min) : 0
    input.style.setProperty('--range-fraction', String(fraction))
  }

  onMount(() => {
    createEffect(
      on(
        [
          () => local.value,
          () => local.defaultValue,
          () => props.min,
          () => props.max,
          () => props.step,
          () => props.style,
        ],
        sync,
      ),
    )
  })
  onFormReset(
    () => input,
    () => {
      local.resetValue?.()
      sync()
    },
  )

  return (
    <input
      {...rest}
      type="range"
      class={classes(styles.range, local.class)}
      ref={(node) => {
        input = node
        assignRef(local.ref, node)
      }}
      onInput={(event) => {
        local.onValueChange(event.currentTarget.valueAsNumber)
        sync()
        callHandler(local.onInput, event)
      }}
    />
  )
}
