/** @fileoverview Native numeric editing with themed step controls. */

import { createUniqueId, Show, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, classes } from '../../../internal/dom'
import { fieldAttributes } from '../../../internal/field'
import { Icon, ChevronDown, ChevronUp } from '../../../internal/icon/glyph'
import { createValue } from '../../../internal/state'
import { NativeInput } from '../native'
import type { InputProps } from '../control'
import { InputFrame } from '../frame'
import frame from '../styles.module.css'
import styles from './styles.module.css'

/**
 * Native numeric editing props with localized step-button labels.
 *
 * Values retain the native string model, including empty state; min, max and step use browser
 * constraints.
 */
export interface NumberInputProps extends Omit<InputProps, 'type' | 'step'> {
  step?: number | 'any'
  /** Number of native steps applied by a button. Typed values still use the input's step constraint. */
  stepCount?: number
  /** Displays a fixed unit beside the value while preserving native numeric submission. */
  unit?: string | undefined
  increaseLabel: string
  decreaseLabel: string
}

/**
 * Renders a numeric editor with themed step buttons following native range and availability state.
 */
export function NumberInput(props: NumberInputProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'value',
    'defaultValue',
    'onValueChange',
    'stepCount',
    'unit',
    'aria-describedby',
    'increaseLabel',
    'decreaseLabel',
    'size',
    'ref',
    'class',
    'style',
  ])
  const field = fieldAttributes(props)
  const unitId = createUniqueId()
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? '',
    (next) => local.onValueChange?.(next),
  )
  let input!: HTMLInputElement

  function step(direction: 1 | -1) {
    if (input.step === 'any') {
      const next =
        (Number.isNaN(input.valueAsNumber) ? 0 : input.valueAsNumber) +
        direction * (local.stepCount ?? 1)
      input.valueAsNumber = Math.min(
        input.max ? Number(input.max) : Infinity,
        Math.max(input.min ? Number(input.min) : -Infinity, next),
      )
    } else if (direction === 1) {
      input.stepUp(local.stepCount ?? 1)
    } else {
      input.stepDown(local.stepCount ?? 1)
    }
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const blocked = () => (props.disabled ?? field.disabled) || props.readOnly

  return (
    <InputFrame class={local.class} style={local.style} size={local.size}>
      <NativeInput
        {...rest}
        class={classes(frame.editor, styles.editor)}
        type="number"
        aria-describedby={
          [local['aria-describedby'] ?? field['aria-describedby'], local.unit ? unitId : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
        value={value()}
        defaultValue={local.defaultValue}
        onValueChange={change}
        ref={(node) => {
          input = node
          assignRef(local.ref, node)
        }}
      />
      <Show when={local.unit}>
        <span id={unitId} class={styles.unit}>
          {local.unit}
        </span>
      </Show>
      <span class={classes(frame.end, styles.steps)}>
        <button
          type="button"
          tabIndex={-1}
          aria-label={local.increaseLabel}
          disabled={blocked() || (value() !== '' && Number(value()) >= Number(props.max))}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => step(1)}
        >
          <Icon icon={ChevronUp} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={local.decreaseLabel}
          disabled={blocked() || (value() !== '' && Number(value()) <= Number(props.min))}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => step(-1)}
        >
          <Icon icon={ChevronDown} />
        </button>
      </span>
    </InputFrame>
  )
}
