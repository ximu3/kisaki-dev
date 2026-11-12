/** @fileoverview Native numeric editing with themed step controls. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, classes } from '../../../internal/dom'
import { fieldAttributes } from '../../../internal/field'
import { Icon, ChevronDown, ChevronUp } from '../../../internal/icon/glyph'
import { createValue } from '../../../internal/state'
import { NativeInput } from '../native'
import type { NativeInputProps } from '../native'
import { InputFrame } from '../frame'
import frame from '../styles.module.css'
import styles from './styles.module.css'

/**
 * Native numeric editing props with localized step-button labels.
 *
 * Values retain the native string model, including empty state; min, max and step use browser
 * constraints.
 */
export interface NumberInputProps extends Omit<NativeInputProps, 'type' | 'step'> {
  step?: number
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
    'increaseLabel',
    'decreaseLabel',
    'ref',
    'class',
    'style',
  ])
  const field = fieldAttributes(props)
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? '',
    (next) => local.onValueChange?.(next),
  )
  let input!: HTMLInputElement

  /** Steps the native numeric value in the requested direction and dispatches its input event. */
  const step = (direction: 1 | -1) => {
    if (direction === 1) {
      input.stepUp()
    } else {
      input.stepDown()
    }
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
  /** Checks whether disabled or readonly state prevents numeric step actions. */
  const blocked = () => (props.disabled ?? field.disabled) || props.readOnly

  return (
    <InputFrame class={local.class} style={local.style}>
      <NativeInput
        {...rest}
        class={classes(frame.editor, styles.editor)}
        type="number"
        value={value()}
        defaultValue={local.defaultValue}
        onValueChange={change}
        ref={(node) => {
          input = node
          assignRef(local.ref, node)
        }}
      />
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
