import { converter, formatHex, formatHex8, parse, type Hsv } from 'culori'
import { createEffect, createMemo, createSignal, createUniqueId, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { fieldAttributes, closeWhenUnavailable } from '../../../internal/field'
import { createPopup } from '../../../internal/popup/controller'
import { createValue, onFormReset } from '../../../internal/state'
import { NativeInput } from '../native'
import { nativeValidityChanged } from '../../../internal/form'
import { InputFrame } from '../frame'
import frame from '../styles.module.css'
import type { InputProps } from '../control'
import { RangeInput } from '../../../internal/range/control'
import popup from '../../../internal/popup/surface.module.css'
import styles from './styles.module.css'

const toHsv = converter('hsv')

/**
 * Color-text input with an alpha-capable picker and localized channel and validation labels.
 *
 * Typed color syntax is retained; picker gestures produce hexadecimal color values.
 */
export interface ColorInputProps extends Omit<InputProps, 'type'> {
  pickerLabel: string
  hueLabel: string
  saturationLabel: string
  brightnessLabel: string
  alphaLabel: string
  invalidColorMessage: string
}

/**
 * Connects color text and picker edits to one form value while retaining invalid text for
 * correction.
 */
export function ColorInput(props: ColorInputProps): JSX.Element {
  const rest = omit(
    props,
    'value',
    'defaultValue',
    'onValueChange',
    'pickerLabel',
    'hueLabel',
    'saturationLabel',
    'brightnessLabel',
    'alphaLabel',
    'invalidColorMessage',
    'size',
    'ref',
    'class',
    'style',
  )

  const field = fieldAttributes(props)
  const [value, change] = createValue(
    () => props.value,
    () => props.defaultValue ?? '',
    (next) => props.onValueChange?.(next),
  )
  const parsed = createMemo(() => parse(value()))
  const [color, setColor] = createSignal<Hsv>({ mode: 'hsv', h: 0, s: 1, v: 1, alpha: 1 })

  const [open, setOpen] = createSignal(false)
  const [trigger, bindTrigger] = createSignal<HTMLButtonElement>()
  const id = createUniqueId()
  let input!: HTMLInputElement
  let picker!: HTMLDivElement
  let hue!: HTMLInputElement
  const blocked = () => (props.disabled ?? field.disabled) || props.readonly
  const swatch = () => (parsed() ? formatHex8(parsed()) : 'transparent')

  createEffect(
    () => toHsv(parsed()),
    (next) => {
      if (next) {
        // Achromatic values have no hue. Preserve the user's picker position.
        setColor((previous) => ({ ...next, h: next.h ?? previous.h ?? 0 }))
      }
    },
  )

  const commit = (next: Partial<Hsv>) => {
    const updated = { ...color(), ...next }
    const requested = (updated.alpha ?? 1) < 1 ? formatHex8(updated) : formatHex(updated)
    input.value = requested
    input.dispatchEvent(new Event('input', { bubbles: true }))
    queueMicrotask(() => {
      if (value() === requested) {
        setColor(updated)
      }
    })
  }

  const paint = (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
    const rect = event.currentTarget.getBoundingClientRect()
    commit({
      s: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      v: 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    })
  }

  createPopup({
    element: () => picker,

    anchor: trigger,
    open,
    change: setOpen,

    placement: () => 'bottom-start',
  })
  closeWhenUnavailable(
    () => input,
    () => setOpen(false),
  )
  onFormReset(
    () => input,
    () => setOpen(false),
  )
  createEffect(
    () => (value() && !parsed() ? props.invalidColorMessage : ''),
    (message) => {
      input.setCustomValidity(message)
      nativeValidityChanged(input.form)
    },
  )

  createEffect(
    () => open(),
    (opened) => {
      if (opened) {
        queueMicrotask(() => {
          if (open()) {
            hue.focus()
          }
        })
      }
    },
  )

  return (
    <InputFrame class={props.class} style={props.style} size={props.size} open={open()}>
      <NativeInput
        {...rest}
        class={frame.editor}
        type="text"
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
      <button
        ref={bindTrigger}
        type="button"
        class={[frame.start, styles.swatch]}
        aria-label={props.pickerLabel}
        popovertarget={id}
        aria-haspopup="dialog"
        aria-controls={id}
        aria-expanded={open() ? 'true' : 'false'}
        disabled={blocked()}
        onClick={(event) => {
          event.preventDefault()
          setOpen(!open())
        }}
      >
        <span style={{ background: swatch() }} />
      </button>
      <div
        ref={(node) => {
          picker = node
        }}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={props.pickerLabel}
        class={[popup.anchor, styles.picker]}
        onFocusOut={(event) => {
          if (
            !picker.contains(event.relatedTarget as Node | null) &&
            event.relatedTarget !== trigger()
          ) {
            setOpen(false)
          }
        }}
      >
        <div class={[popup.viewport, styles.content]}>
          <div
            aria-hidden="true"
            class={styles.plane}
            style={{ '--color-hue': `hsl(${color().h ?? 0} 100% 50%)` }}
            onPointerDown={(event) => {
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              paint(event)
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                paint(event)
              }
            }}
          >
            <span
              class={styles.cursor}
              style={{ left: `${color().s * 100}%`, top: `${(1 - color().v) * 100}%` }}
            />
          </div>
          <label class={styles.channel}>
            <span>{props.hueLabel}</span>
            <RangeInput
              min={0}
              ref={(node) => {
                hue = node
              }}
              max={360}
              value={color().h ?? 0}
              onValueChange={(h) => commit({ h })}
            />
            <output>{Math.round(color().h ?? 0)}°</output>
          </label>
          <label class={styles.channel}>
            <span>{props.saturationLabel}</span>
            <RangeInput
              min={0}
              value={color().s * 100}
              onValueChange={(value) => commit({ s: value / 100 })}
            />
            <output>{Math.round(color().s * 100)}%</output>
          </label>
          <label class={styles.channel}>
            <span>{props.brightnessLabel}</span>
            <RangeInput
              min={0}
              value={color().v * 100}
              onValueChange={(value) => commit({ v: value / 100 })}
            />
            <output>{Math.round(color().v * 100)}%</output>
          </label>
          <label class={styles.channel}>
            <span>{props.alphaLabel}</span>
            <RangeInput
              min={0}
              value={(color().alpha ?? 1) * 100}
              onValueChange={(value) => commit({ alpha: value / 100 })}
            />
            <output>{Math.round((color().alpha ?? 1) * 100)}%</output>
          </label>
        </div>
      </div>
    </InputFrame>
  )
}
