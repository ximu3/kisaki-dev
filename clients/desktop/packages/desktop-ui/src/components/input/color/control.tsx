/** @fileoverview CSS color text and an alpha-capable picker share one controlled value. */

import { converter, formatHex, formatHex8, parse } from 'culori'
import type { Hsv } from 'culori'
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  onMount,
  splitProps,
  untrack,
} from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, classes } from '../../../internal/dom'
import { fieldAttributes, closeWhenUnavailable } from '../../../internal/field'
import { createPopup } from '../../../internal/popup/controller'
import { createValue, onFormReset } from '../../../internal/state'
import { NativeInput } from '../native'
import type { InputProps } from '../control'
import range from '../../../internal/range.module.css'
import surface from '../../../internal/popup/surface.module.css'
import styles from './styles.module.css'

/** Typed CSS color syntax is retained; picker gestures produce hex with alpha when needed. */
export interface ColorInputProps extends Omit<InputProps, 'type'> {
  pickerLabel: string
  hueLabel: string
  saturationLabel: string
  brightnessLabel: string
  alphaLabel: string
  invalidColorMessage: string
}

/** Text and picker edits share a form value. Invalid text stays available for correction. */
export function ColorInput(props: ColorInputProps): JSX.Element {
  const toHsv = converter('hsv')
  const [local, rest] = splitProps(props, [
    'value',
    'defaultValue',
    'onValueChange',
    'pickerLabel',
    'hueLabel',
    'saturationLabel',
    'brightnessLabel',
    'alphaLabel',
    'invalidColorMessage',
    'ref',
  ])
  const field = fieldAttributes()
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? '',
    (next) => local.onValueChange?.(next),
  )
  const parsed = createMemo(() => parse(value()))
  const [color, setColor] = createSignal<Hsv>({ mode: 'hsv', h: 0, s: 1, v: 1, alpha: 1 })
  const [open, setOpen] = createSignal(false)
  const id = createUniqueId()
  let input!: HTMLInputElement
  let trigger!: HTMLButtonElement
  let picker!: HTMLDivElement
  let hue!: HTMLInputElement
  const blocked = () => (props.disabled ?? field.disabled) || props.readOnly
  const swatch = () => (parsed() ? formatHex8(parsed()) : 'transparent')

  createEffect(() => {
    const next = toHsv(parsed())
    if (next) {
      setColor({ ...next, h: next.h ?? untrack(color).h ?? 0 })
    }
  })
  const commit = (next: Partial<Hsv>) => {
    const updated = { ...color(), ...next }
    setColor(updated)
    change((updated.alpha ?? 1) < 1 ? formatHex8(updated) : formatHex(updated))
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
    anchor: () => trigger,
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
  onMount(() => {
    createEffect(() =>
      input.setCustomValidity(value() && !parsed() ? local.invalidColorMessage : ''),
    )
    createEffect(() => {
      if (open()) {
        queueMicrotask(() => {
          if (open()) {
            hue.focus()
          }
        })
      }
    })
  })

  return (
    <div class={styles.container}>
      <NativeInput
        {...rest}
        type="text"
        value={value()}
        defaultValue={local.defaultValue}
        onValueChange={change}
        ref={(node) => {
          input = node
          assignRef(local.ref, node)
        }}
      />
      <button
        ref={(node) => {
          trigger = node
        }}
        type="button"
        class={styles.swatch}
        aria-label={local.pickerLabel}
        aria-haspopup="dialog"
        aria-controls={id}
        aria-expanded={open()}
        disabled={blocked()}
        onClick={() => setOpen(!open())}
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
        aria-label={local.pickerLabel}
        class={classes(surface.surface, styles.picker)}
        onFocusOut={(event) => {
          if (
            !picker.contains(event.relatedTarget as Node | null) &&
            event.relatedTarget !== trigger
          ) {
            setOpen(false)
          }
        }}
      >
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
          <span>{local.hueLabel}</span>
          <input
            ref={(node) => {
              hue = node
            }}
            type="range"
            class={range.range}
            min="0"
            max="360"
            step="1"
            value={color().h ?? 0}
            onInput={(event) => commit({ h: event.currentTarget.valueAsNumber })}
          />
          <output>{Math.round(color().h ?? 0)}°</output>
        </label>
        <label class={styles.channel}>
          <span>{local.saturationLabel}</span>
          <input
            type="range"
            class={range.range}
            min="0"
            max="100"
            step="1"
            value={color().s * 100}
            onInput={(event) => commit({ s: event.currentTarget.valueAsNumber / 100 })}
          />
          <output>{Math.round(color().s * 100)}%</output>
        </label>
        <label class={styles.channel}>
          <span>{local.brightnessLabel}</span>
          <input
            type="range"
            class={range.range}
            min="0"
            max="100"
            step="1"
            value={color().v * 100}
            onInput={(event) => commit({ v: event.currentTarget.valueAsNumber / 100 })}
          />
          <output>{Math.round(color().v * 100)}%</output>
        </label>
        <label class={styles.channel}>
          <span>{local.alphaLabel}</span>
          <input
            type="range"
            class={range.range}
            min="0"
            max="100"
            step="1"
            value={(color().alpha ?? 1) * 100}
            onInput={(event) => commit({ alpha: event.currentTarget.valueAsNumber / 100 })}
          />
          <output>{Math.round((color().alpha ?? 1) * 100)}%</output>
        </label>
      </div>
    </div>
  )
}
