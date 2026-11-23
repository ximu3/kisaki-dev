/** @fileoverview Native numeric editing with themed step controls. */

import { createMemo, createUniqueId, Show, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
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

/** Reads an HTML number boundary with the same numeric syntax as the native editor. */
function numberBound(value: InputProps['min'], unbounded: number): number {
  if (value == null || value === false || value === '') {
    return unbounded
  }

  const parser = document.createElement('input')
  parser.type = 'number'
  parser.value = String(value)
  return Number.isNaN(parser.valueAsNumber) ? unbounded : parser.valueAsNumber
}

/**
 * Renders a numeric editor with themed step buttons following native range and availability state.
 */
export function NumberInput(props: NumberInputProps): JSX.Element {
  const rest = omit(
    props,
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
  )
  const field = fieldAttributes(props)
  const unitId = createUniqueId()
  const [value, change] = createValue(
    () => props.value,
    () => props.defaultValue ?? '',
    (next) => props.onValueChange?.(next),
  )
  const min = createMemo(() => numberBound(props.min, -Infinity))
  const max = createMemo(() => numberBound(props.max, Infinity))
  let input!: HTMLInputElement

  function step(direction: 1 | -1) {
    if (input.step === 'any') {
      const next =
        (Number.isNaN(input.valueAsNumber) ? 0 : input.valueAsNumber) +
        direction * (props.stepCount ?? 1)
      input.valueAsNumber = Math.min(max(), Math.max(min(), next))
    } else if (direction === 1) {
      input.stepUp(props.stepCount ?? 1)
    } else {
      input.stepDown(props.stepCount ?? 1)
    }
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const blocked = () => (props.disabled ?? field.disabled) || props.readonly

  return (
    <InputFrame class={props.class} style={props.style} size={props.size}>
      <NativeInput
        {...rest}
        class={[frame.editor, styles.editor]}
        type="number"
        aria-describedby={
          [props['aria-describedby'] ?? field['aria-describedby'], props.unit ? unitId : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
        value={value()}
        defaultValue={props.defaultValue}
        onValueChange={change}
        ref={[
          (node) => {
            input = node
          },
          props.ref,
        ]}
      />
      <Show when={props.unit}>
        <span id={unitId} class={styles.unit}>
          {props.unit}
        </span>
      </Show>
      <span class={[frame.end, styles.steps]}>
        <button
          type="button"
          tabindex={-1}
          aria-label={props.increaseLabel}
          disabled={blocked() || (value() !== '' && Number(value()) >= max())}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => step(1)}
        >
          <Icon icon={ChevronUp} />
        </button>
        <button
          type="button"
          tabindex={-1}
          aria-label={props.decreaseLabel}
          disabled={blocked() || (value() !== '' && Number(value()) <= min())}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => step(-1)}
        >
          <Icon icon={ChevronDown} />
        </button>
      </span>
    </InputFrame>
  )
}
