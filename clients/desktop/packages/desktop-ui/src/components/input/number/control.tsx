import { createMemo, createUniqueId, Show, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { fieldAttributes } from '../../../internal/field'
import { mdiChevronDown, mdiChevronUp } from '@mdi/js'
import { Icon } from '../../icon'
import { createValue } from '../../../internal/state'
import { NativeInput } from '../native'
import type { InputProps } from '../control'
import { InputFrame } from '../frame'
import frame from '../styles.module.css'
import styles from './styles.module.css'

export interface NumberInputProps extends Omit<InputProps, 'type' | 'step'> {
  step?: number | 'any'
  positive?: boolean
  stepCount?: number
  unit?: string | undefined
  increaseLabel: string
  decreaseLabel: string
}

function numberBound(value: InputProps['min'], unbounded: number): number {
  if (value == null || value === false || value === '') {
    return unbounded
  }

  const parser = document.createElement('input')
  parser.type = 'number'
  parser.value = String(value)
  return Number.isNaN(parser.valueAsNumber) ? unbounded : parser.valueAsNumber
}

export function NumberInput(props: NumberInputProps): JSX.Element {
  const rest = omit(
    props,
    'value',
    'defaultValue',
    'onValueChange',
    'stepCount',
    'positive',
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
  const min = createMemo(() => {
    const bound = numberBound(props.min, -Infinity)
    return props.positive ? Math.max(bound, Number.MIN_VALUE) : bound
  })
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
  function canDecrease() {
    const current = Number(value() || 0)
    if (props.positive && props.step === 'any' && min() === Number.MIN_VALUE) {
      return current > (props.stepCount ?? 1)
    }
    return value() === '' || current > min()
  }
  const blocked = () => (props.disabled ?? field.disabled) || props.readonly

  return (
    <InputFrame class={props.class} style={props.style} size={props.size}>
      <NativeInput
        {...rest}
        class={[frame.editor, styles.editor]}
        type="number"
        min={props.positive ? min() : props.min}
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
          <Icon path={mdiChevronUp} />
        </button>
        <button
          type="button"
          tabindex={-1}
          aria-label={props.decreaseLabel}
          disabled={blocked() || !canDecrease()}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => step(-1)}
        >
          <Icon path={mdiChevronDown} />
        </button>
      </span>
    </InputFrame>
  )
}
