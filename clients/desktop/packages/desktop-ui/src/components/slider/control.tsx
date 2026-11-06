/** @fileoverview Native range slider with numeric value and reset ownership. */

import { createEffect, onMount, splitProps, untrack } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { createValue, onFormReset } from '../../internal/state'
import styles from './styles.module.css'

/** min/max/step use native range rules; defaultValue defaults to the native midpoint. */
export interface SliderProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'min' | 'max' | 'step'
> {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void

  min?: number
  max?: number
  step?: number | 'any'
}

/** Arrow, Home and End behavior stays native; use aria-valuetext when units need explanation. */
export function Slider(props: SliderProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'value',
    'defaultValue',
    'onValueChange',
    'class',
    'ref',
    'onInput',
  ])

  const baseline = () => local.defaultValue ?? ((props.min ?? 0) + (props.max ?? 100)) / 2
  const [value, change] = createValue(
    () => local.value,
    baseline,
    (next) => local.onValueChange?.(next),
  )
  let input!: HTMLInputElement
  const sync = () => {
    input.value = String(value())
  }

  onMount(() => {
    createEffect(() => {
      input.defaultValue = String(baseline())
      untrack(sync)
    })
    createEffect(sync)
  })
  onFormReset(
    () => input,
    () => {
      change(baseline())
      sync()
    },
  )

  return (
    <input
      {...fieldAttributes()}
      {...rest}
      type="range"
      ref={(node) => {
        input = node
        assignRef(local.ref, node)
      }}
      class={classes(styles.root, local.class)}
      onInput={(event) => {
        change(event.currentTarget.valueAsNumber)
        untrack(sync)
        callHandler(local.onInput, event)
      }}
    />
  )
}
