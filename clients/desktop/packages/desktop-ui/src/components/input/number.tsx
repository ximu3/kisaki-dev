/** @fileoverview Native numeric editing with themed step controls. */

import { createEffect, createSignal, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { Icon, mdiChevronDown, mdiChevronUp } from '../../internal/icons'
import { NativeInput } from './native'
import type { NativeInputProps } from './native'
import styles from './styles.module.css'

/** Values retain the native string model, including the empty state; min, max and step stay native. */
export interface NumberInputProps extends Omit<NativeInputProps, 'type' | 'step'> {
  step?: number
  increaseLabel: string
  decreaseLabel: string
}

export function NumberInput(props: NumberInputProps): JSX.Element {
  const [local, rest] = splitProps(props, ['increaseLabel', 'decreaseLabel', 'ref', 'onInput'])
  const field = fieldAttributes()
  const [text, setText] = createSignal(props.value ?? props.defaultValue ?? '')
  let input!: HTMLInputElement
  createEffect(() => {
    if (props.value !== undefined) {
      setText(props.value)
    }
  })

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
    <div class={styles.number}>
      <NativeInput
        {...rest}
        type="number"
        ref={(node) => {
          input = node
          assignRef(local.ref, node)
        }}
        onInput={(event) => {
          setText(event.currentTarget.value)
          callHandler(local.onInput, event)
        }}
      />
      <span class={styles.steps}>
        <button
          type="button"
          tabIndex={-1}
          aria-label={local.increaseLabel}
          disabled={blocked() || (text() !== '' && Number(text()) >= Number(props.max))}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => step(1)}
        >
          <Icon path={mdiChevronUp} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={local.decreaseLabel}
          disabled={blocked() || (text() !== '' && Number(text()) <= Number(props.min))}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => step(-1)}
        >
          <Icon path={mdiChevronDown} />
        </button>
      </span>
    </div>
  )
}
