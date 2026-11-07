/** @fileoverview Native numeric editing with themed step controls. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, classes } from '../../../internal/dom'
import { fieldAttributes } from '../../../internal/field'
import { Icon, mdiChevronDown, mdiChevronUp } from '../../../internal/icon/icon'
import { createValue } from '../../../internal/state'
import { NativeInput } from '../native'
import type { NativeInputProps } from '../native'
import { InputFrame } from '../frame'
import frame from '../styles.module.css'
import styles from './styles.module.css'

/** Values retain the native string model, including the empty state; min, max and step stay native. */
export interface NumberInputProps extends Omit<NativeInputProps, 'type' | 'step'> {
  step?: number
  increaseLabel: string
  decreaseLabel: string
}

/** The step buttons edit the native number field and follow its range and disabled state. */
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
  const field = fieldAttributes()
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? '',
    (next) => local.onValueChange?.(next),
  )
  let input!: HTMLInputElement

  const step = (direction: 1 | -1) => {
    if (direction === 1) {
      input.stepUp()
    } else {
      input.stepDown()
    }
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
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
          <Icon path={mdiChevronUp} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={local.decreaseLabel}
          disabled={blocked() || (value() !== '' && Number(value()) <= Number(props.min))}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => step(-1)}
        >
          <Icon path={mdiChevronDown} />
        </button>
      </span>
    </InputFrame>
  )
}
